"""Move legacy workflow attachment bytes from PostgreSQL to object storage.

Run after MinIO is reachable and before the binary table is removed in a later
migration. The command is idempotent: rows with ``storage_key`` are skipped and
the source blob is deleted only after a successful object write.
"""

from __future__ import annotations

import asyncio
import json

import sqlalchemy as sa

from app.core.db import SessionFactory
from app.models.workflow import WorkflowAttachment, WorkflowAttachmentBlob
from app.services.object_storage import get_object_storage


async def migrate() -> dict[str, int]:
    report = {"migrated": 0, "skipped": 0, "missing_blob": 0, "failed": 0}
    storage = get_object_storage()
    async with SessionFactory() as session:
        rows = await session.execute(
            sa.select(WorkflowAttachment, WorkflowAttachmentBlob.data)
            .join(
                WorkflowAttachmentBlob,
                WorkflowAttachmentBlob.attachment_id == WorkflowAttachment.id,
            )
            .where(WorkflowAttachment.storage_key.is_(None))
            .order_by(WorkflowAttachment.created_at)
        )
        for attachment, data in rows:
            key = f"attachments/{attachment.id}"
            try:
                await storage.put(key, data, attachment.content_type)
                attachment.storage_key = key
                await session.execute(
                    sa.delete(WorkflowAttachmentBlob).where(
                        WorkflowAttachmentBlob.attachment_id == attachment.id
                    )
                )
                await session.commit()
                report["migrated"] += 1
            except Exception:
                await session.rollback()
                report["failed"] += 1
        return report


def main() -> None:
    print(json.dumps(asyncio.run(migrate()), ensure_ascii=False))


if __name__ == "__main__":
    main()
