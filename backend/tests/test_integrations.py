"""Integration scaffold: contract mapping, sources, ingest (SPEC-04, трек C).

The API contract is not available yet (`OPEN-01`, `OPEN-04`), so these tests
pin down the machinery around it: the mapping layer, both source
implementations, and the ingest rules. When the real contract lands, only the
contract fixtures change — these tests keep their meaning.
"""

from __future__ import annotations

import datetime as dt

import httpx
import pytest
import sqlalchemy as sa

from app.integrations.contract import (
    LMS_CONTRACT,
    WEBSITE_CONTRACT,
    read_path,
)
from app.integrations.ingest import IntegrationService, describe_sources
from app.integrations.records import normalize
from app.integrations.sources import (
    FixtureSource,
    HttpJsonSource,
    IntegrationUnavailableError,
    build_source,
)
from app.models.enums import (
    AuditAction,
    ImportRowStatus,
    IntegrationMode,
    IntegrationSource,
    IntegrationSyncStatus,
)
from app.models.interaction import Interaction
from app.models.university import University
from app.schemas.university import UniversityCreate
from app.services.audit import search_audit_log
from app.services.catalogs import UniversityService
from app.services.workflow_presets import ensure_base_workflow
from tests.conftest import auth

# --- contract mapping ------------------------------------------------------


def test_read_path_walks_nested_documents():
    payload = {"items": [{"university": {"name": "МГТУ"}}]}
    assert read_path(payload, "items.0.university.name") == "МГТУ"
    assert read_path(payload, "items.9.university") is None
    assert read_path(payload, "nope.deeper") is None
    assert read_path(payload, None) is None


def test_contracts_unwrap_their_own_envelopes():
    """Два источника присылают разные конверты — слой соответствия их выравнивает."""
    lms = {"items": [{"id": "1"}], "next_cursor": "c2"}
    assert LMS_CONTRACT.records(lms) == [{"id": "1"}]
    assert LMS_CONTRACT.next_cursor(lms) == "c2"

    site = {"data": [{"uuid": "1"}], "links": {"next": None}}
    assert WEBSITE_CONTRACT.records(site) == [{"uuid": "1"}]
    assert WEBSITE_CONTRACT.next_cursor(site) is None


def test_both_contracts_cover_the_core_internal_fields():
    """Источники могут отдавать разный объём, но ядро обязаны покрывать оба."""
    core = {
        "external_id",
        "university_name",
        "direction_name",
        "product_name",
        "contract_number",
        "license_signed_at",
        "license_years",
        "transfer_status",
    }
    for contract in (LMS_CONTRACT, WEBSITE_CONTRACT):
        assert core <= set(contract.fields), contract.title
    # Сайт не отдаёт идентификатор вуза — это допустимое различие, не ошибка.
    assert "university_external_id" in LMS_CONTRACT.fields


# --- normalisation ---------------------------------------------------------


def test_lms_record_is_normalised():
    raw = {
        "id": "lms-1",
        "university": {"id": "u-1", "name": "  МГТУ   им. Баумана ", "region": "г. Москва"},
        "direction": "DevOps",
        "product": {"name": "Astra Linux", "vendor": "Астра"},
        "manager": "Камов Кирилл Андреевич",
        "contract_number": "ДЛ-1",
        "license_signed_at": "17.02.2026",
        "license_years": 3,
        "status": "Передано",
        "contacts": [{"full_name": "Соколова Анна", "email": "a@example.edu"}],
    }
    record, messages = normalize(LMS_CONTRACT, raw)
    assert messages == []
    assert record.university_name == "МГТУ им. Баумана"
    assert record.license_signed_at == dt.date(2026, 2, 17)
    assert record.license_years == 3
    assert record.contacts[0].full_name == "Соколова Анна"


def test_website_record_is_normalised_from_different_field_names():
    raw = {
        "uuid": "web-1",
        "vuz_nazvanie": "КФУ",
        "napravlenie": "QA",
        "po": "Альт",
        "data_podpisaniya": "2026-03-01",
        "srok_licenzii": "5",
        "otvetstvennye_vuza": [{"fio": "Гарипов Ильдар", "dolzhnost": "Декан"}],
    }
    record, messages = normalize(WEBSITE_CONTRACT, raw)
    assert messages == []
    assert record.external_id == "web-1"
    assert record.university_name == "КФУ"
    assert record.license_signed_at == dt.date(2026, 3, 1)
    assert record.license_years == 5
    assert record.contacts[0].position == "Декан"


def test_missing_university_name_is_an_error():
    record, messages = normalize(LMS_CONTRACT, {"id": "x", "university": {"name": "   "}})
    assert record.university_name is None
    assert any(m.level is ImportRowStatus.ERROR for m in messages)


def test_bad_values_degrade_to_warnings():
    record, messages = normalize(
        LMS_CONTRACT,
        {
            "id": "x",
            "university": {"name": "МГТУ"},
            "license_signed_at": "когда-нибудь",
            "license_years": 99,
        },
    )
    assert record.license_signed_at is None
    assert record.license_years is None
    assert all(m.level is ImportRowStatus.WARNING for m in messages)


# --- sources ---------------------------------------------------------------


async def test_fixture_source_ships_demo_data():
    for source in IntegrationSource:
        records = await FixtureSource(source).fetch()
        assert records, f"нет демонстрационных данных для {source.value}"


def test_source_falls_back_to_fixture_without_a_url():
    """Чекаут без настроек работает сразу, без обращений наружу."""
    for source in IntegrationSource:
        assert build_source(source).mode is IntegrationMode.FIXTURE


def test_http_source_is_used_once_configured(monkeypatch):
    from app.core import config

    monkeypatch.setattr(config.settings, "integrations_mode", IntegrationMode.HTTP)
    monkeypatch.setattr(config.settings, "lms_api_url", "https://lms.example/api/feed")
    assert build_source(IntegrationSource.LMS).mode is IntegrationMode.HTTP
    # Источник без адреса всё равно остаётся на фикстуре.
    assert build_source(IntegrationSource.WEBSITE).mode is IntegrationMode.FIXTURE


async def test_http_source_follows_pagination_and_sends_the_token():
    pages = {
        None: {"items": [{"id": "a"}], "next_cursor": "p2"},
        "p2": {"items": [{"id": "b"}], "next_cursor": None},
    }
    seen_auth: list[str | None] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen_auth.append(request.headers.get("Authorization"))
        return httpx.Response(200, json=pages[request.url.params.get("cursor")])

    source = HttpJsonSource(
        IntegrationSource.LMS,
        base_url="https://lms.example/api/feed",
        token="secret",
        transport=httpx.MockTransport(handler),
    )
    records = await source.fetch()
    assert [item["id"] for item in records] == ["a", "b"]
    assert seen_auth == ["Bearer secret", "Bearer secret"]


async def test_http_source_stops_at_the_page_limit():
    """Зацикленный курсор не должен уводить приём в бесконечность."""

    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"items": [{"id": "x"}], "next_cursor": "always"})

    source = HttpJsonSource(
        IntegrationSource.LMS,
        base_url="https://lms.example/api/feed",
        page_limit=3,
        transport=httpx.MockTransport(handler),
    )
    assert len(await source.fetch()) == 3


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(500, text="boom"),
        httpx.Response(200, text="не json", headers={"content-type": "application/json"}),
    ],
)
async def test_http_failures_surface_as_unavailable(response):
    source = HttpJsonSource(
        IntegrationSource.LMS,
        base_url="https://lms.example/api/feed",
        transport=httpx.MockTransport(lambda request: response),
    )
    with pytest.raises(IntegrationUnavailableError):
        await source.fetch()


async def test_connection_error_surfaces_as_unavailable():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("нет связи", request=request)

    source = HttpJsonSource(
        IntegrationSource.LMS,
        base_url="https://lms.example/api/feed",
        transport=httpx.MockTransport(handler),
    )
    with pytest.raises(IntegrationUnavailableError):
        await source.fetch()


# --- ingest ----------------------------------------------------------------


async def test_dry_run_reports_without_writing(session, scope):
    service = IntegrationService(session, scope)
    run = await service.sync(IntegrationSource.LMS, dry_run=True)

    assert run.status is IntegrationSyncStatus.SUCCEEDED
    assert run.dry_run is True
    assert run.stats["to_create"] == 3
    assert run.stats["errors"] == 1

    for table in ("universities", "vendors", "it_products", "interactions"):
        count = await session.scalar(sa.text(f"SELECT count(*) FROM {table}"))
        assert count == 0, f"{table} изменилась при dry-run"

    # Сам запуск при этом сохранён — иначе о нём нечего было бы показать.
    stored = await service.get_run(run.id)
    assert stored.messages


async def test_commit_writes_and_repeat_creates_no_duplicates(session, scope):
    service = IntegrationService(session, scope)
    first = await service.sync(IntegrationSource.LMS, dry_run=False)
    assert first.stats["created"] == 3

    second = await service.sync(IntegrationSource.LMS, dry_run=False)
    assert second.stats["created"] == 0
    assert second.stats["updated"] == 3

    for table in ("universities", "it_products", "interactions"):
        count = await session.scalar(sa.text(f"SELECT count(*) FROM {table}"))
        assert count == 3, f"{table} задвоилась при повторном запуске"


async def test_record_with_an_error_is_skipped_and_the_rest_apply(session, scope):
    run = await IntegrationService(session, scope).sync(IntegrationSource.LMS, dry_run=False)
    assert run.stats["errors"] == 1
    assert run.stats["skipped"] == 1
    assert run.stats["created"] == 3

    errors = [m for m in run.messages if m["level"] == "error"]
    assert len(errors) == 1
    assert errors[0]["record"] == "lms-10244"


async def test_the_same_university_from_two_feeds_stays_one_row(session, scope):
    """Оба канала пишут через сервисный слой, поэтому вуз не задваивается."""
    service = IntegrationService(session, scope)
    await service.sync(IntegrationSource.LMS, dry_run=False)
    await service.sync(IntegrationSource.WEBSITE, dry_run=False)

    bauman = await session.scalar(
        sa.select(sa.func.count())
        .select_from(University)
        .where(University.name_normalized.like("мгту%"))
    )
    assert bauman == 1


async def test_a_near_duplicate_name_is_flagged_not_merged(session, scope):
    run = await IntegrationService(session, scope).sync(IntegrationSource.WEBSITE, dry_run=False)
    suggestions = [m for m in run.messages if m.get("suggestion")]
    assert suggestions, "похожее название должно попасть в замечания"
    assert "Казанский федеральный университет" in suggestions[0]["text"]

    names = set(
        (
            await session.scalars(
                sa.select(University.name).where(University.name.ilike("Казанск%"))
            )
        ).all()
    )
    assert len(names) == 2, "записи не сливаются автоматически"


async def test_empty_incoming_value_does_not_erase_stored_data(session, scope):
    service = IntegrationService(session, scope)
    await service.sync(IntegrationSource.LMS, dry_run=False)

    interaction = await session.scalar(
        sa.select(Interaction).where(Interaction.contract_number == "ДЛ-2026/114")
    )
    assert interaction is not None
    assert interaction.comment == "Курс запущен на двух потоках"

    # Сайт присылает ту же карточку, но без ряда полей.
    await service.sync(IntegrationSource.WEBSITE, dry_run=False)
    await session.refresh(interaction)
    assert interaction.license_signed_at == dt.date(2026, 2, 17)
    assert interaction.license_years == 3


async def test_known_manager_is_matched(session, scope, kam_user):
    await IntegrationService(session, scope).sync(IntegrationSource.LMS, dry_run=False)
    interaction = await session.scalar(
        sa.select(Interaction).where(Interaction.contract_number == "ДЛ-2026/114")
    )
    assert interaction.responsible_user_id == kam_user.id


async def test_unknown_manager_is_a_warning_and_the_record_still_lands(session, scope):
    run = await IntegrationService(session, scope).sync(IntegrationSource.LMS, dry_run=False)
    assert any("не найден среди сотрудников" in m["text"] for m in run.messages)
    assert run.stats["created"] == 3


async def test_new_cards_join_the_workflow(session, scope):
    """FR-06 / C3: полученные данные попадают в workflow."""
    await ensure_base_workflow(session, scope)
    await IntegrationService(session, scope).sync(IntegrationSource.LMS, dry_run=False)

    on_route = await session.scalar(
        sa.select(sa.func.count())
        .select_from(Interaction)
        .where(Interaction.current_stage_id.is_not(None))
    )
    assert on_route == 3


async def test_sync_is_audited(session, scope):
    run = await IntegrationService(session, scope).sync(IntegrationSource.LMS, dry_run=False)
    entries, total = await search_audit_log(
        session, entity_type="integration_sync_runs", action=AuditAction.IMPORT
    )
    assert total == 1
    assert entries[0].entity_id == run.id
    assert entries[0].changes["source"] == "lms"
    assert entries[0].changes["dry_run"] is False


async def test_unreachable_source_fails_the_run_without_raising(session, scope):
    source = HttpJsonSource(
        IntegrationSource.LMS,
        base_url="https://lms.example/api/feed",
        transport=httpx.MockTransport(lambda request: httpx.Response(503)),
    )
    run = await IntegrationService(session, scope).sync(
        IntegrationSource.LMS, dry_run=False, external_source=source
    )
    assert run.status is IntegrationSyncStatus.FAILED
    assert run.error_message


async def test_existing_university_is_enriched_not_overwritten(session, scope):
    existing = await UniversityService(session, scope).create(
        UniversityCreate(name="МГТУ им. Н.Э. Баумана", region="ранее заполненный регион")
    )
    await IntegrationService(session, scope).sync(IntegrationSource.LMS, dry_run=False)

    await session.refresh(existing)
    assert existing.region == "ранее заполненный регион", "заполненное не затирается"
    assert existing.external_id == "u-0077", "пустое дозаполняется"


def test_sources_are_described_as_provisional():
    described = {item["source"]: item for item in describe_sources()}
    assert set(described) == set(IntegrationSource)
    for item in described.values():
        assert item["contract_is_provisional"] is True
        assert item["fields"]


# --- API -------------------------------------------------------------------


async def test_sources_endpoint(session, client, manager_user):
    response = await client.get("/api/v1/integrations/sources", headers=auth(manager_user))
    assert response.status_code == 200
    body = {item["source"]: item for item in response.json()}
    assert body["lms"]["mode"] == "fixture"
    assert body["lms"]["contract_is_provisional"] is True
    assert body["website"]["fields"]["university_name"] == "vuz_nazvanie"


async def test_sync_endpoint_defaults_to_dry_run(session, client, manager_user):
    response = await client.post(
        "/api/v1/integrations/lms/sync", json={}, headers=auth(manager_user)
    )
    assert response.status_code == 200
    body = response.json()
    assert body["run"]["dry_run"] is True
    assert body["stats"]["to_create"] == 3
    assert body["stats"]["created"] == 0

    count = await session.scalar(sa.text("SELECT count(*) FROM universities"))
    assert count == 0


async def test_sync_endpoint_writes_when_asked(session, client, manager_user):
    response = await client.post(
        "/api/v1/integrations/lms/sync", json={"dry_run": False}, headers=auth(manager_user)
    )
    assert response.json()["stats"]["created"] == 3

    history = await client.get("/api/v1/integrations/syncs", headers=auth(manager_user))
    assert history.json()["total"] == 1

    run_id = response.json()["run"]["id"]
    one = await client.get(f"/api/v1/integrations/syncs/{run_id}", headers=auth(manager_user))
    assert one.json()["status"] == "succeeded"


async def test_sync_requires_manager_role(session, client, kam_user):
    response = await client.post(
        "/api/v1/integrations/lms/sync", json={"dry_run": True}, headers=auth(kam_user)
    )
    assert response.status_code == 403


async def test_unknown_source_is_rejected(session, client, manager_user):
    response = await client.post(
        "/api/v1/integrations/telegram/sync", json={}, headers=auth(manager_user)
    )
    assert response.status_code == 422
