"""Data access for integration sync runs."""

from __future__ import annotations

from typing import ClassVar

from app.models.integration import IntegrationSyncRun
from app.repositories.base import BaseRepository


class IntegrationSyncRunRepository(BaseRepository[IntegrationSyncRun]):
    model = IntegrationSyncRun
    sortable_fields: ClassVar[tuple[str, ...]] = ("created_at", "finished_at", "source")
    default_order: ClassVar[tuple[str, ...]] = ("-created_at",)
