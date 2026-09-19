"""Treat assignment end dates as exclusive for same-day handoffs.

Revision ID: 0011_assignment_period_boundaries
Revises: 0010_notification_rule_uniqueness
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011_assignment_period_boundaries"
down_revision: str | None = "0010_notification_rule_uniqueness"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(
        "university_assignments_no_overlap",
        table_name="university_assignments",
        type_="exclude",
    )
    op.create_exclude_constraint(
        "university_assignments_no_overlap",
        "university_assignments",
        (sa.literal_column("university_id"), "="),
        (sa.literal_column("daterange(assigned_from, assigned_to, '[)')"), "&&"),
        where=sa.text("deleted_at IS NULL"),
        using="gist",
    )


def downgrade() -> None:
    op.drop_constraint(
        "university_assignments_no_overlap",
        table_name="university_assignments",
        type_="exclude",
    )
    op.create_exclude_constraint(
        "university_assignments_no_overlap",
        "university_assignments",
        (sa.literal_column("university_id"), "="),
        (sa.literal_column("daterange(assigned_from, assigned_to, '[]')"), "&&"),
        where=sa.text("deleted_at IS NULL"),
        using="gist",
    )
