"""Add notification outbox, card chat and education activities.

Revision ID: 0009_communications_education
Revises: 0008_counterparty_groups
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0009_communications_education"
down_revision: str | None = "0008_counterparty_groups"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

UUID = postgresql.UUID(as_uuid=True)
JSONB = postgresql.JSONB(astext_type=sa.Text())


def base_columns() -> list[sa.Column]:
    return [
        sa.Column("id", UUID, primary_key=True),
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
        sa.Column("created_by", UUID),
        sa.Column("updated_by", UUID),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    ]


def upgrade() -> None:
    op.create_table(
        "notification_rules",
        *base_columns(),
        sa.Column(
            "workflow_transition_id",
            UUID,
            sa.ForeignKey("workflow_transitions.id", ondelete="CASCADE"),
        ),
        sa.Column("stale_after_days", sa.SmallInteger()),
        sa.Column("recipient_kind", sa.Text(), nullable=False),
        sa.Column("recipient_role", sa.Text()),
        sa.Column("recipient_user_id", UUID, sa.ForeignKey("users.id", ondelete="RESTRICT")),
        sa.Column("channel", sa.Text(), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.CheckConstraint(
            "(workflow_transition_id IS NULL) <> (stale_after_days IS NULL)",
            name="notification_rule_event",
        ),
        sa.CheckConstraint(
            "stale_after_days IS NULL OR stale_after_days > 0", name="notification_rule_stale_days"
        ),
        sa.CheckConstraint(
            "recipient_kind IN ('responsible', 'manager', 'role', 'user')",
            name="notification_rule_recipient",
        ),
        sa.CheckConstraint(
            "channel IN ('email', 'telegram', 'max')", name="notification_rule_channel"
        ),
    )
    op.create_index(
        "ix_notification_rules_transition", "notification_rules", ["workflow_transition_id"]
    )
    op.create_table(
        "notification_deliveries",
        *base_columns(),
        sa.Column(
            "rule_id",
            UUID,
            sa.ForeignKey("notification_rules.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "interaction_id",
            UUID,
            sa.ForeignKey("interactions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "university_id",
            UUID,
            sa.ForeignKey("universities.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("recipient_user_id", UUID, sa.ForeignKey("users.id", ondelete="RESTRICT")),
        sa.Column("channel", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False, server_default="queued"),
        sa.Column("attempts", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("dedupe_key", sa.Text(), nullable=False, unique=True),
        sa.Column("payload", JSONB, nullable=False),
        sa.Column("error_message", sa.Text()),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint(
            "status IN ('queued', 'sent', 'failed')", name="notification_delivery_status"
        ),
    )
    op.create_index(
        "ix_notification_deliveries_pending", "notification_deliveries", ["status", "created_at"]
    )
    op.create_index(
        "ix_notification_deliveries_interaction", "notification_deliveries", ["interaction_id"]
    )
    op.create_table(
        "chat_messages",
        *base_columns(),
        sa.Column(
            "interaction_id",
            UUID,
            sa.ForeignKey("interactions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "university_id",
            UUID,
            sa.ForeignKey("universities.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "author_id", UUID, sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
        ),
        sa.Column("body", sa.Text(), nullable=False),
    )
    op.create_index(
        "ix_chat_messages_interaction_created", "chat_messages", ["interaction_id", "created_at"]
    )
    op.create_table(
        "education_participants",
        *base_columns(),
        sa.Column(
            "university_id",
            UUID,
            sa.ForeignKey("universities.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("full_name", sa.Text(), nullable=False),
        sa.Column("email", sa.Text()),
        sa.Column("kind", sa.Text(), nullable=False),
        sa.CheckConstraint("kind IN ('learner', 'teacher')", name="education_participant_kind"),
    )
    op.create_index(
        "ix_education_participants_university", "education_participants", ["university_id"]
    )
    op.create_table(
        "education_activities",
        *base_columns(),
        sa.Column("university_id", UUID, sa.ForeignKey("universities.id", ondelete="RESTRICT")),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("federal_project", sa.Text()),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("ends_at > starts_at", name="education_activity_period"),
    )
    op.create_index(
        "ix_education_activities_period", "education_activities", ["starts_at", "ends_at"]
    )
    op.create_index("ix_education_activities_university", "education_activities", ["university_id"])
    op.create_table(
        "education_activity_participants",
        *base_columns(),
        sa.Column(
            "activity_id",
            UUID,
            sa.ForeignKey("education_activities.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "participant_id",
            UUID,
            sa.ForeignKey("education_participants.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "activity_id", "participant_id", name="education_activity_participant_unique"
        ),
    )


def downgrade() -> None:
    for table in (
        "education_activity_participants",
        "education_activities",
        "education_participants",
        "chat_messages",
        "notification_deliveries",
        "notification_rules",
    ):
        op.drop_table(table)
