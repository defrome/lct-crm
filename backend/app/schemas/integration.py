"""Contracts for the integration endpoints (SPEC-04 scaffold)."""

from __future__ import annotations

import datetime as dt
import uuid
from typing import Any

from pydantic import BaseModel, Field

from app.models.enums import (
    IntegrationMode,
    IntegrationSource,
    IntegrationSyncStatus,
)
from app.schemas.common import ORMModel


class IntegrationSyncStats(BaseModel):
    total: int = 0
    to_create: int = Field(default=0, description="Сколько карточек будет создано")
    to_update: int = Field(default=0, description="Сколько карточек будет обновлено")
    skipped: int = 0
    errors: int = 0
    warnings: int = 0
    created: int = Field(default=0, description="Фактически создано; при dry-run всегда 0")
    updated: int = Field(default=0, description="Фактически обновлено; при dry-run всегда 0")
    contacts_created: int = 0


class SyncRequest(BaseModel):
    dry_run: bool = Field(
        default=True,
        description=(
            "По умолчанию `true`: синхронизация разбирает данные и сообщает, что "
            "изменится, ничего не записывая. Для реальной записи передайте `false`"
        ),
    )


class IntegrationSyncRunRead(ORMModel):
    id: uuid.UUID
    source: IntegrationSource
    mode: IntegrationMode
    status: IntegrationSyncStatus
    dry_run: bool
    stats: dict[str, Any]
    messages: list[Any]
    error_message: str | None
    created_at: dt.datetime
    finished_at: dt.datetime | None
    created_by: uuid.UUID | None


class SyncResult(BaseModel):
    run: IntegrationSyncRunRead
    stats: IntegrationSyncStats


class SourceDescription(BaseModel):
    """Во что сейчас воткнута интеграция и по какому соответствию полей."""

    source: IntegrationSource
    title: str
    mode: IntegrationMode = Field(
        description="`fixture` — демонстрационные данные из репозитория, `http` — реальный API"
    )
    url: str | None = Field(default=None, description="Адрес внешнего API, если он настроен")
    contract_is_provisional: bool = Field(
        description=(
            "Контракт принят по допущению: заказчик не передал ни описание API "
            "(OPEN-01), ни перечень согласованных полей (OPEN-04)"
        )
    )
    fields: dict[str, str] = Field(
        description="Соответствие «поле CRM → путь в JSON внешней системы»"
    )
