"""Administrator-configured KAM visibility rules (UC-A-01).

Revision ID: 0006_user_visibility
Revises: 0005_integration_syncs
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006_user_visibility"
down_revision: str | None = "0005_integration_syncs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    visibility_mode = sa.Enum("assignments", "selected", "all", name="user_visibility_mode")
    visibility_mode.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "users",
        sa.Column(
            "visibility_mode",
            visibility_mode,
            nullable=False,
            server_default="assignments",
        ),
    )
    op.create_table(
        "user_visibility_universities",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("university_id", sa.UUID(), nullable=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("created_by", sa.UUID(), nullable=True),
        sa.Column("updated_by", sa.UUID(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="RESTRICT",
            name=op.f("fk_user_visibility_universities_user_id_users"),
        ),
        sa.ForeignKeyConstraint(
            ["university_id"],
            ["universities.id"],
            ondelete="RESTRICT",
            name=op.f("fk_user_visibility_universities_university_id_universities"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user_visibility_universities")),
        sa.UniqueConstraint("user_id", "university_id", name="user_visibility_university_unique"),
    )
    op.create_index(
        "ix_user_visibility_universities_user_id", "user_visibility_universities", ["user_id"]
    )
    op.create_index(
        "ix_user_visibility_universities_university_id",
        "user_visibility_universities",
        ["university_id"],
    )
    op.create_index(
        op.f("ix_user_visibility_universities_deleted_at"),
        "user_visibility_universities",
        ["deleted_at"],
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_user_visibility_universities_deleted_at"),
        table_name="user_visibility_universities",
    )
    op.drop_index(
        "ix_user_visibility_universities_university_id", table_name="user_visibility_universities"
    )
    op.drop_index(
        "ix_user_visibility_universities_user_id", table_name="user_visibility_universities"
    )
    op.drop_table("user_visibility_universities")
    op.drop_column("users", "visibility_mode")
    sa.Enum(name="user_visibility_mode").drop(op.get_bind(), checkfirst=True)
