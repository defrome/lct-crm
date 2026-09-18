"""Communication and education data kept outside the core CRM tables (track H)."""

from __future__ import annotations

import datetime as dt
import uuid
from typing import ClassVar

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import DomainBase


class NotificationRule(DomainBase):
    __tablename__ = "notification_rules"
    workflow_transition_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("workflow_transitions.id", ondelete="CASCADE"), default=None
    )
    # A NULL transition makes this a stalled-card reminder rule.
    stale_after_days: Mapped[int | None] = mapped_column(sa.SmallInteger, default=None)
    recipient_kind: Mapped[str] = mapped_column(
        sa.Text, nullable=False
    )  # responsible, manager, role, user
    recipient_role: Mapped[str | None] = mapped_column(sa.Text, default=None)
    recipient_user_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("users.id", ondelete="RESTRICT"), default=None
    )
    channel: Mapped[str] = mapped_column(sa.Text, nullable=False)  # email, telegram, max
    is_enabled: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, default=True, server_default=sa.true()
    )

    __table_args__ = (
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
        sa.Index("ix_notification_rules_transition", "workflow_transition_id"),
    )


class NotificationDelivery(DomainBase):
    __tablename__ = "notification_deliveries"
    rule_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("notification_rules.id", ondelete="RESTRICT"), nullable=False
    )
    interaction_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("interactions.id", ondelete="RESTRICT"), nullable=False
    )
    university_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("universities.id", ondelete="RESTRICT"), nullable=False
    )
    recipient_user_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("users.id", ondelete="RESTRICT"), default=None
    )
    channel: Mapped[str] = mapped_column(sa.Text, nullable=False)
    status: Mapped[str] = mapped_column(
        sa.Text, nullable=False, default="queued", server_default="queued"
    )
    attempts: Mapped[int] = mapped_column(
        sa.SmallInteger, nullable=False, default=0, server_default="0"
    )
    dedupe_key: Mapped[str] = mapped_column(sa.Text, nullable=False, unique=True)
    payload: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False, default=dict)
    error_message: Mapped[str | None] = mapped_column(sa.Text, default=None)
    sent_at: Mapped[dt.datetime | None] = mapped_column(default=None)

    __table_args__ = (
        sa.CheckConstraint(
            "status IN ('queued', 'sent', 'failed')", name="notification_delivery_status"
        ),
        sa.Index("ix_notification_deliveries_pending", "status", "created_at"),
        sa.Index("ix_notification_deliveries_interaction", "interaction_id"),
    )


class ChatMessage(DomainBase):
    __tablename__ = "chat_messages"
    __pd_fields__: ClassVar[frozenset[str]] = frozenset({"body"})
    interaction_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("interactions.id", ondelete="RESTRICT"), nullable=False
    )
    university_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("universities.id", ondelete="RESTRICT"), nullable=False
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    body: Mapped[str] = mapped_column(sa.Text, nullable=False)
    author = relationship("User", lazy="selectin")

    __table_args__ = (
        sa.Index("ix_chat_messages_interaction_created", "interaction_id", "created_at"),
    )


class EducationParticipant(DomainBase):
    __tablename__ = "education_participants"
    __pd_fields__: ClassVar[frozenset[str]] = frozenset({"full_name", "email"})
    university_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("universities.id", ondelete="RESTRICT"), nullable=False
    )
    full_name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    email: Mapped[str | None] = mapped_column(sa.Text, default=None)
    kind: Mapped[str] = mapped_column(sa.Text, nullable=False)  # learner, teacher
    __table_args__ = (
        sa.CheckConstraint("kind IN ('learner', 'teacher')", name="education_participant_kind"),
        sa.Index("ix_education_participants_university", "university_id"),
    )


class EducationActivity(DomainBase):
    __tablename__ = "education_activities"
    university_id: Mapped[uuid.UUID | None] = mapped_column(
        sa.ForeignKey("universities.id", ondelete="RESTRICT"), default=None
    )
    name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    federal_project: Mapped[str | None] = mapped_column(sa.Text, default=None)
    starts_at: Mapped[dt.datetime] = mapped_column(nullable=False)
    ends_at: Mapped[dt.datetime] = mapped_column(nullable=False)
    __table_args__ = (
        sa.CheckConstraint("ends_at > starts_at", name="education_activity_period"),
        sa.Index("ix_education_activities_period", "starts_at", "ends_at"),
        sa.Index("ix_education_activities_university", "university_id"),
    )


class EducationActivityParticipant(DomainBase):
    __tablename__ = "education_activity_participants"
    activity_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("education_activities.id", ondelete="CASCADE"), nullable=False
    )
    participant_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("education_participants.id", ondelete="RESTRICT"), nullable=False
    )
    __table_args__ = (
        sa.UniqueConstraint(
            "activity_id", "participant_id", name="education_activity_participant_unique"
        ),
    )
