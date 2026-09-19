"""Repository for the core `interactions` table."""

from __future__ import annotations

import uuid
from typing import Any, ClassVar

import sqlalchemy as sa
from sqlalchemy.sql import Select

from app.models.interaction import Interaction
from app.repositories.base import BaseRepository, visible_interaction_condition


class InteractionRepository(BaseRepository[Interaction]):
    model = Interaction
    searchable_fields: ClassVar[tuple[str, ...]] = (
        "contract_number",
        "transfer_status",
        "comment",
    )
    sortable_fields: ClassVar[tuple[str, ...]] = (
        "license_signed_at",
        "license_expires_at",
        "contract_number",
        "created_at",
        "updated_at",
    )
    default_order: ClassVar[tuple[str, ...]] = ("-created_at",)
    university_scope_column: ClassVar[str | None] = "university_id"

    def _access_filter(self, stmt: Select[Any]) -> Select[Any]:
        """A responsible KAM can see an explicitly assigned card anywhere.

        University assignments remain the default visibility boundary for
        unassigned cards, but assigning a card to a user must also make that
        card visible to its new owner.
        """
        return stmt.where(visible_interaction_condition(self.scope, Interaction))

    async def find_by_business_key(
        self,
        university_id: uuid.UUID,
        it_direction_id: uuid.UUID | None,
        it_product_id: uuid.UUID | None,
    ) -> Interaction | None:
        """Look up by (university, direction, product) — the upsert key.

        `IS NOT DISTINCT FROM` is what makes NULL match NULL here, mirroring the
        COALESCE-based partial unique index on the table.
        """
        stmt = sa.select(Interaction).where(
            Interaction.university_id == university_id,
            Interaction.it_direction_id.is_not_distinct_from(it_direction_id),
            Interaction.it_product_id.is_not_distinct_from(it_product_id),
            Interaction.deleted_at.is_(None),
        )
        return await self.session.scalar(stmt)
