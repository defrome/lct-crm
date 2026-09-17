"""Bookkeeping for integration runs (SPEC-04 scaffold).

One row per synchronisation attempt. The real integrations will need exactly
this — "what did we pull, when, and what did it change?" is the first question
anyone asks when a nightly sync goes wrong — so it is built now rather than
bolted on later.
"""

from __future__ import annotations

import datetime as dt
from typing import Any

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import DomainBase
from app.models.enums import (
    INTEGRATION_MODE_ENUM,
    INTEGRATION_SOURCE_ENUM,
    INTEGRATION_SYNC_STATUS_ENUM,
    IntegrationMode,
    IntegrationSource,
    IntegrationSyncStatus,
)


def _pg_enum(enum_cls: type, name: str) -> sa.Enum:
    return sa.Enum(enum_cls, name=name, values_callable=lambda e: [m.value for m in e])


class IntegrationSyncRun(DomainBase):
    __tablename__ = "integration_sync_runs"

    source: Mapped[IntegrationSource] = mapped_column(
        _pg_enum(IntegrationSource, INTEGRATION_SOURCE_ENUM), nullable=False
    )
    mode: Mapped[IntegrationMode] = mapped_column(
        _pg_enum(IntegrationMode, INTEGRATION_MODE_ENUM), nullable=False
    )
    status: Mapped[IntegrationSyncStatus] = mapped_column(
        _pg_enum(IntegrationSyncStatus, INTEGRATION_SYNC_STATUS_ENUM),
        nullable=False,
        default=IntegrationSyncStatus.RUNNING,
    )
    # A dry run reports what it would change and writes nothing.
    dry_run: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, default=False, server_default=sa.false()
    )
    stats: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict, server_default=sa.text("'{}'::jsonb")
    )
    # Per-record verdicts, mirroring `import_rows` but kept inline: an API feed
    # is a fraction of the size of a spreadsheet upload.
    messages: Mapped[list[Any]] = mapped_column(
        JSONB, nullable=False, default=list, server_default=sa.text("'[]'::jsonb")
    )
    error_message: Mapped[str | None] = mapped_column(sa.Text, default=None)
    finished_at: Mapped[dt.datetime | None] = mapped_column(default=None)

    __table_args__ = (
        sa.Index("ix_integration_sync_runs_source_created_at", "source", "created_at"),
        sa.Index("ix_integration_sync_runs_status", "status"),
    )
