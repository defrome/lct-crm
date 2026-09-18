"""Store uploaded files in MinIO.

Revision ID: 0007_minio_object_storage
Revises: 0006_user_visibility
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007_minio_object_storage"
down_revision: str | None = "0006_user_visibility"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("workflow_attachments", sa.Column("storage_key", sa.Text(), nullable=True))
    op.add_column("import_jobs", sa.Column("storage_key", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("import_jobs", "storage_key")
    op.drop_column("workflow_attachments", "storage_key")
