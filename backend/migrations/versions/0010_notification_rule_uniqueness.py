"""Prevent duplicate enabled notification rules."""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0010_notification_rule_uniqueness"
down_revision: str | None = "0009_communications_education"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


_INDEX = "uq_notification_rules_enabled_definition"


def upgrade() -> None:
    # Keep the oldest row when a deployment already contains accidental
    # duplicates; deliveries referencing the older rule remain intact.
    op.execute(
        """
        WITH ranked AS (
            SELECT id,
                   row_number() OVER (
                       PARTITION BY
                           coalesce(workflow_transition_id, '00000000-0000-0000-0000-000000000000'::uuid),
                           coalesce(stale_after_days, 0),
                           recipient_kind,
                           coalesce(recipient_role, ''),
                           coalesce(recipient_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
                           channel
                       ORDER BY created_at, id
                   ) AS duplicate_number
            FROM notification_rules
            WHERE deleted_at IS NULL AND is_enabled
        )
        UPDATE notification_rules AS rules
           SET deleted_at = now(), is_enabled = false
          FROM ranked
         WHERE rules.id = ranked.id AND ranked.duplicate_number > 1
        """
    )
    op.execute(
        f"""
        CREATE UNIQUE INDEX {_INDEX}
            ON notification_rules (
                coalesce(workflow_transition_id, '00000000-0000-0000-0000-000000000000'::uuid),
                coalesce(stale_after_days, 0),
                recipient_kind,
                coalesce(recipient_role, ''),
                coalesce(recipient_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
                channel
            )
         WHERE deleted_at IS NULL AND is_enabled
        """
    )


def downgrade() -> None:
    op.execute(f"DROP INDEX IF EXISTS {_INDEX}")
