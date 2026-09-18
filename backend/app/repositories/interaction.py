"""Repository for the core `interactions` table."""

from __future__ import annotations

import uuid
from typing import Any, ClassVar

import sqlalchemy as sa
from sqlalchemy.sql import Select

from app.models.interaction import Interaction
from app.repositories.base import BaseRepository, visible_university_ids


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
        """Expose unassigned cards as a shared work queue for KAMs.

        A card with a responsible manager remains visible according to the
        university assignment policy.  Until a manager is selected, however,
        every ordinary user must be able to pick the card up and work on it.
        """
        if self.scope.is_privileged or self.scope.visibility_mode == "all":
            return stmt
        return stmt.where(
            sa.or_(
                Interaction.responsible_user_id.is_(None),
                Interaction.university_id.in_(visible_university_ids(self.scope)),
            )
        )

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
