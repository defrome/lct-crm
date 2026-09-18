"""Assign workflows and cards to counterparty groups.

Revision ID: 0008_workflow_counterparty_groups
Revises: 0007_minio_object_storage
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008_workflow_counterparty_groups"
down_revision: str | None = "0007_minio_object_storage"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# The type is created explicitly below.  ``create_type=False`` prevents the
# column DDL from attempting a second CREATE TYPE on PostgreSQL.
counterparty_group = postgresql.ENUM("b2b", "b2c", name="counterparty_group", create_type=False)


def upgrade() -> None:
    counterparty_group.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "workflows",
        sa.Column("counterparty_group", counterparty_group, nullable=False, server_default="b2b"),
    )
    op.add_column(
        "interactions",
        sa.Column("counterparty_group", counterparty_group, nullable=False, server_default="b2b"),
    )
    op.drop_index(
        "uq_workflows_single_default",
        table_name="workflows",
        postgresql_where=sa.text("is_default AND deleted_at IS NULL"),
    )
    op.create_index(
        "uq_workflows_default_per_counterparty_group",
        "workflows",
        ["counterparty_group"],
        unique=True,
        postgresql_where=sa.text("is_default AND deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_workflows_default_per_counterparty_group",
        table_name="workflows",
        postgresql_where=sa.text("is_default AND deleted_at IS NULL"),
    )
    op.create_index(
        "uq_workflows_single_default",
        "workflows",
        [sa.literal_column("(is_default)")],
        unique=True,
        postgresql_where=sa.text("is_default AND deleted_at IS NULL"),
    )
    op.drop_column("interactions", "counterparty_group")
    op.drop_column("workflows", "counterparty_group")
    counterparty_group.drop(op.get_bind(), checkfirst=True)
