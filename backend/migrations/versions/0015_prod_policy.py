"""Production policy: user hierarchy, chat mentions and retention metadata."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0015_prod_policy"
down_revision: str | None = "0014_customer_import_entities"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

def upgrade() -> None:
    op.add_column("users", sa.Column("manager_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_users_manager_id_users", "users", "users", ["manager_id"], ["id"], ondelete="RESTRICT")
    op.create_index("ix_users_manager_id", "users", ["manager_id"])
    op.add_column("chat_messages", sa.Column("mention_user_ids", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")))

def downgrade() -> None:
    op.drop_column("chat_messages", "mention_user_ids")
    op.drop_index("ix_users_manager_id", table_name="users")
    op.drop_constraint("fk_users_manager_id_users", "users", type_="foreignkey")
    op.drop_column("users", "manager_id")
