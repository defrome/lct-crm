"""Store chat-message attachments in object storage.

Revision ID: 0012_chat_attachments
Revises: 0011_assignment_period_boundaries
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0012_chat_attachments"
down_revision: str | None = "0011_assignment_period_boundaries"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _base_columns() -> list[sa.Column]:
    return [
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
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
        sa.Column("created_by", postgresql.UUID(as_uuid=True)),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True)),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    ]


def upgrade() -> None:
    attachment_format = postgresql.ENUM(name="attachment_format", create_type=False)
    op.create_table(
        "chat_attachments",
        *_base_columns(),
        sa.Column(
            "message_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("chat_messages.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "interaction_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("interactions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "university_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("universities.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("filename", sa.Text(), nullable=False),
        sa.Column("file_format", attachment_format, nullable=False),
        sa.Column("content_type", sa.Text(), nullable=False),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("file_hash", sa.Text(), nullable=False),
        sa.Column("storage_key", sa.Text()),
    )
    op.create_index("ix_chat_attachments_deleted_at", "chat_attachments", ["deleted_at"])
    op.create_index("ix_chat_attachments_message", "chat_attachments", ["message_id"])
    op.create_index("ix_chat_attachments_interaction", "chat_attachments", ["interaction_id"])
    op.create_index("ix_chat_attachments_university", "chat_attachments", ["university_id"])


def downgrade() -> None:
    op.drop_index("ix_chat_attachments_university", table_name="chat_attachments")
    op.drop_index("ix_chat_attachments_interaction", table_name="chat_attachments")
    op.drop_index("ix_chat_attachments_message", table_name="chat_attachments")
    op.drop_index("ix_chat_attachments_deleted_at", table_name="chat_attachments")
    op.drop_table("chat_attachments")
