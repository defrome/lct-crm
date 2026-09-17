"""Ingesting external records into the CRM (FR-06, UC-U-02 — scaffold).

The pipeline is the real one: fetch → normalise → match → upsert → place on the
workflow → audit. Only the *shape* of the incoming JSON is assumed; see
`contract.py`.

Two deliberate choices, both inherited from the spreadsheet import because an
integration is the same problem arriving through a different door:

* **Everything is written through the service layer.** `find_or_create` on the
  catalog services and `InteractionService.upsert` are what the import uses, so
  a university arriving from the LMS and the same university typed into Excel
  fold to one row instead of two near-duplicates.
* **Dry run first.** A run can report exactly what it would change without
  writing anything, so a new feed can be pointed at production and inspected
  before it is trusted.
"""

from __future__ import annotations

import datetime as dt
import logging
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access import AccessScope
from app.core.errors import AppError, InternalError
from app.imports.validators import RowMessage, warning
from app.integrations.contract import contract_for
from app.integrations.records import NormalizedRecord, normalize
from app.integrations.sources import ExternalSource, build_source
from app.models.enums import (
    AuditAction,
    ImportRowStatus,
    IntegrationMode,
    IntegrationSource,
    IntegrationSyncStatus,
)
from app.models.integration import IntegrationSyncRun
from app.repositories.integration import IntegrationSyncRunRepository
from app.services.audit import log_event
from app.services.catalogs import (
    ITDirectionService,
    ITProductService,
    UniversityContactService,
    UniversityService,
    VendorService,
)
from app.services.interactions import InteractionService
from app.services.text import normalize_name
from app.services.users import UserService

logger = logging.getLogger(__name__)

# A feed with thousands of broken records should not turn one jsonb column into
# a megabyte; the count in `stats` stays exact either way.
MAX_STORED_MESSAGES = 200


def _empty_stats() -> dict[str, int]:
    return {
        "total": 0,
        "to_create": 0,
        "to_update": 0,
        "skipped": 0,
        "errors": 0,
        "warnings": 0,
        "created": 0,
        "updated": 0,
        "contacts_created": 0,
    }


class IntegrationService:
    def __init__(self, session: AsyncSession, scope: AccessScope | None = None) -> None:
        self.session = session
        self.scope = scope or AccessScope.system()
        self.runs = IntegrationSyncRunRepository(session, self.scope)

        self.universities = UniversityService(session, self.scope)
        self.vendors = VendorService(session, self.scope)
        self.products = ITProductService(session, self.scope)
        self.directions = ITDirectionService(session, self.scope)
        self.contacts = UniversityContactService(session, self.scope)
        self.interactions = InteractionService(session, self.scope)
        self.users = UserService(session, self.scope)

    # -- reading runs -------------------------------------------------------

    async def list_runs(
        self,
        *,
        source: IntegrationSource | None = None,
        page: int = 1,
        size: int = 50,
        sort: str | None = None,
    ) -> tuple[list[IntegrationSyncRun], int]:
        filters = [IntegrationSyncRun.source == source] if source else []
        return await self.runs.list(page=page, size=size, sort=sort, extra_filters=filters)

    async def get_run(self, run_id: uuid.UUID) -> IntegrationSyncRun:
        return await self.runs.get_or_fail(run_id)

    # -- running a sync -----------------------------------------------------

    async def sync(
        self,
        source: IntegrationSource,
        *,
        dry_run: bool = True,
        external_source: ExternalSource | None = None,
    ) -> IntegrationSyncRun:
        """Pull a feed and apply it. `dry_run` reports without writing."""
        feed = external_source or build_source(source)

        run = IntegrationSyncRun(
            source=source,
            mode=feed.mode,
            status=IntegrationSyncStatus.RUNNING,
            dry_run=dry_run,
            stats=_empty_stats(),
            messages=[],
        )
        self.runs.add(run)
        await self.session.flush()

        try:
            raw_records = await feed.fetch()
        except AppError as exc:
            return await self._fail(run, exc.message)

        stats = _empty_stats()
        stats["total"] = len(raw_records)
        collected: list[dict[str, Any]] = []
        contract = contract_for(source)

        # All writes happen inside a SAVEPOINT. A dry run rolls it back and the
        # run record — which lives in the outer transaction — still survives.
        savepoint = await self.session.begin_nested()
        try:
            for raw in raw_records:
                record, messages = normalize(contract, raw)
                await self._apply(record, messages, stats)
                self._collect(collected, record, messages)

            if dry_run:
                await savepoint.rollback()
            else:
                await savepoint.commit()
                stats["created"] = stats["to_create"]
                stats["updated"] = stats["to_update"]
        except AppError as exc:
            await savepoint.rollback()
            return await self._fail(run, exc.message)
        except Exception as exc:
            logger.exception("integration sync failed for %s", source.value)
            await savepoint.rollback()
            await self._fail(run, str(exc))
            raise InternalError(
                "Синхронизация не выполнена: произошла ошибка, изменения отменены",
                details={"source": source.value},
            ) from exc

        run.status = IntegrationSyncStatus.SUCCEEDED
        run.stats = stats
        run.messages = collected[:MAX_STORED_MESSAGES]
        run.finished_at = dt.datetime.now(dt.UTC)
        await self.session.flush()

        await log_event(
            self.session,
            action=AuditAction.IMPORT,
            entity_type="integration_sync_runs",
            entity_id=run.id,
            changes={
                "source": source.value,
                "mode": feed.mode.value,
                "dry_run": dry_run,
                "stats": stats,
            },
        )
        await self.session.commit()
        return await self.runs.reload(run)

    async def _fail(self, run: IntegrationSyncRun, message: str) -> IntegrationSyncRun:
        run.status = IntegrationSyncStatus.FAILED
        run.error_message = message[:2000]
        run.finished_at = dt.datetime.now(dt.UTC)
        await self.session.flush()
        await self.session.commit()
        return await self.runs.reload(run)

    def _collect(
        self,
        collected: list[dict[str, Any]],
        record: NormalizedRecord,
        messages: list[RowMessage],
    ) -> None:
        for message in messages:
            entry = message.to_dict()
            entry["record"] = record.label()
            collected.append(entry)

    # -- applying one record ------------------------------------------------

    async def _apply(
        self,
        record: NormalizedRecord,
        messages: list[RowMessage],
        stats: dict[str, int],
    ) -> None:
        if any(message.level is ImportRowStatus.ERROR for message in messages):
            stats["errors"] += 1
            stats["skipped"] += 1
            return
        if any(message.level is ImportRowStatus.WARNING for message in messages):
            stats["warnings"] += 1

        assert record.university_name is not None  # guaranteed by normalize()

        university = await self._resolve_university(record, messages)

        vendor_id = None
        if record.vendor_name:
            vendor, _ = await self.vendors.find_or_create(record.vendor_name)
            vendor_id = vendor.id

        product_id = None
        if record.product_name:
            product, _ = await self.products.find_or_create(
                record.product_name, vendor_id=vendor_id
            )
            product_id = product.id

        direction_id = None
        if record.direction_name:
            direction, _ = await self.directions.find_or_create(record.direction_name)
            direction_id = direction.id

        responsible_user_id = None
        if record.manager_full_name:
            user = await self.users.match_by_full_name(record.manager_full_name)
            if user is None:
                messages.append(
                    warning(
                        f"Менеджер «{record.manager_full_name}» не найден среди сотрудников; "
                        "поле «ответственный» останется пустым",
                        "manager_full_name",
                    )
                )
                stats["warnings"] += 1
            else:
                responsible_user_id = user.id

        _, created = await self.interactions.upsert(
            university_id=university.id,
            it_direction_id=direction_id,
            it_product_id=product_id,
            values={
                "contract_number": record.contract_number,
                "license_signed_at": record.license_signed_at,
                "license_years": record.license_years,
                "transfer_status": record.transfer_status,
                "comment": record.comment,
                "responsible_user_id": responsible_user_id,
            },
        )
        # `to_create`/`to_update` are what this run decided; `created`/`updated`
        # are filled in only once the savepoint is actually committed, so a dry
        # run never claims to have written anything.
        if created:
            stats["to_create"] += 1
        else:
            stats["to_update"] += 1

        for contact in record.contacts:
            entity, contact_created = await self.contacts.find_or_create(
                university.id, contact.full_name
            )
            # An empty field from the feed never clears a stored value.
            for attribute in ("position", "email", "phone"):
                value = getattr(contact, attribute)
                if value is not None:
                    setattr(entity, attribute, value)
            if contact_created:
                stats["contacts_created"] += 1
        await self.session.flush()

    async def _resolve_university(
        self, record: NormalizedRecord, messages: list[RowMessage]
    ) -> Any:
        """Match by external id first, then by name — never merge on a guess."""
        name = record.university_name
        assert name is not None

        if record.university_external_id:
            existing = await self.universities.repo.find_by_external_id(
                record.university_external_id
            )
            if existing is not None:
                return existing

        exact = await self.universities.repo.find_by_normalized_name(normalize_name(name))
        if exact is None:
            # Same policy as the spreadsheet import: a near-match is reported,
            # never merged silently.
            similar = await self.universities.suggest_similar(name, limit=1)
            if similar and similar[0][1] >= 0.88:
                candidate, score = similar[0]
                messages.append(
                    warning(
                        f"Вуз «{name}» не найден, но похож на «{candidate.name}» "
                        f"(совпадение {score:.0%}). Будет создан новый вуз — "
                        "объедините записи вручную, если это одно и то же.",
                        "university_name",
                        university_id=str(candidate.id),
                        university_name=candidate.name,
                        score=round(score, 3),
                    )
                )

        university, _ = await self.universities.find_or_create(name)
        # Fill in what the feed knows, without overwriting what we already have.
        if record.university_external_id and not university.external_id:
            university.external_id = record.university_external_id
        if record.region and not university.region:
            university.region = record.region
        if record.inn and not university.inn:
            university.inn = record.inn
        await self.session.flush()
        return university


def describe_sources() -> list[dict[str, Any]]:
    """What each integration is currently wired to — shown by the API."""
    from app.integrations.sources import source_settings

    described = []
    for source in IntegrationSource:
        contract = contract_for(source)
        url, _ = source_settings(source)
        feed = build_source(source)
        described.append(
            {
                "source": source,
                "title": contract.title,
                "mode": feed.mode,
                "url": url,
                "contract_is_provisional": True,
                "fields": dict(contract.fields),
            }
        )
    return described


__all__ = ["IntegrationMode", "IntegrationService", "describe_sources"]
