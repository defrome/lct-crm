"""Store Telegram user IDs for direct notifications."""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013_user_telegram_id"
down_revision: str | None = "0012_chat_attachments"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("telegram_user_id", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "telegram_user_id")
