"""Remove the retired MAX notification channel."""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

revision: str = "0016_remove_max_channel"
down_revision: str | None = "0015_prod_policy"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # MAX deliveries and rules cannot be retained after the channel is removed:
    # deliveries reference their rule and the rule constraint must reject MAX.
    op.execute(
        """
        DELETE FROM notification_deliveries
         WHERE channel = 'max'
            OR rule_id IN (
                SELECT id FROM notification_rules WHERE channel = 'max'
            )
        """
    )
    op.execute("DELETE FROM notification_rules WHERE channel = 'max'")
    op.drop_constraint("notification_rule_channel", "notification_rules", type_="check")
    op.create_check_constraint(
        "notification_rule_channel",
        "notification_rules",
        "channel IN ('email', 'telegram')",
    )


def downgrade() -> None:
    op.drop_constraint("notification_rule_channel", "notification_rules", type_="check")
    op.create_check_constraint(
        "notification_rule_channel",
        "notification_rules",
        "channel IN ('email', 'telegram', 'max')",
    )
