from __future__ import annotations

import datetime as dt
import uuid

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel
from app.schemas.user import UserShort


class NotificationRuleCreate(BaseModel):
    workflow_transition_id: uuid.UUID | None = None
    stale_after_days: int | None = Field(default=None, ge=1)
    recipient_kind: str
    recipient_role: str | None = None
    recipient_user_id: uuid.UUID | None = None
    channel: str


class NotificationRuleRead(NotificationRuleCreate, ORMModel):
    id: uuid.UUID
    is_enabled: bool


class NotificationDeliveryRead(ORMModel):
    id: uuid.UUID
    interaction_id: uuid.UUID
    recipient_user_id: uuid.UUID | None
    channel: str
    status: str
    attempts: int
    error_message: str | None
    created_at: dt.datetime
    sent_at: dt.datetime | None


class ChatMessageCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class ChatMessageRead(ORMModel):
    id: uuid.UUID
    interaction_id: uuid.UUID
    author_id: uuid.UUID
    author: UserShort
    body: str
    created_at: dt.datetime


class ParticipantCreate(BaseModel):
    university_id: uuid.UUID
    full_name: str = Field(min_length=1, max_length=500)
    email: str | None = Field(default=None, max_length=320)
    kind: str


class ParticipantRead(ParticipantCreate, ORMModel):
    id: uuid.UUID


class ActivityCreate(BaseModel):
    university_id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=500)
    federal_project: str | None = Field(default=None, max_length=500)
    starts_at: dt.datetime
    ends_at: dt.datetime
    participant_ids: list[uuid.UUID] = Field(default_factory=list)


class ActivityRead(ORMModel):
    id: uuid.UUID
    university_id: uuid.UUID | None
    name: str
    federal_project: str | None
    starts_at: dt.datetime
    ends_at: dt.datetime
    participants: list[ParticipantRead]
