"""Treat assignment end dates as exclusive for same-day handoffs.

Revision ID: 0011_assignment_period_boundaries
Revises: 0010_notification_rule_unique
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011_assignment_period_boundaries"
down_revision: str | None = "0010_notification_rule_unique"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Alembic updates this row after ``upgrade`` returns.  The revision ID is
    # 33 characters long, while Alembic creates the column as VARCHAR(32).
    # Widen it before Alembic tries to record this revision.
    op.alter_column(
        "alembic_version",
        "version_num",
        existing_type=sa.String(length=32),
        type_=sa.String(length=64),
        existing_nullable=False,
    )
    op.execute(
        "ALTER TABLE university_assignments DROP CONSTRAINT university_assignments_no_overlap"
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
    # Do not narrow ``alembic_version.version_num`` here.  Alembic still holds
    # this 33-character revision until after this function returns.
    op.execute(
        "ALTER TABLE university_assignments DROP CONSTRAINT university_assignments_no_overlap"
    )
    op.create_exclude_constraint(
        "university_assignments_no_overlap",
        "university_assignments",
        (sa.literal_column("university_id"), "="),
        (sa.literal_column("daterange(assigned_from, assigned_to, '[]')"), "&&"),
        where=sa.text("deleted_at IS NULL"),
        using="gist",
    )
