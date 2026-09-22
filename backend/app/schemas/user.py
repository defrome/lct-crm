"""Schemas for the local user projection."""

from __future__ import annotations

import datetime as dt
import uuid

from pydantic import Field

from app.models.enums import UserRole, UserVisibilityMode
from app.schemas.common import ORMModel


class UserRead(ORMModel):
    id: uuid.UUID
    keycloak_id: str
    full_name: str
    email: str | None = None
    telegram_user_id: str | None = None
    role: UserRole
    is_active: bool
    visibility_mode: UserVisibilityMode
    created_at: dt.datetime
    updated_at: dt.datetime


class UserShort(ORMModel):
    """Compact form embedded in other responses."""

    id: uuid.UUID
    full_name: str
    role: UserRole


class UserCreate(ORMModel):
    keycloak_id: str = Field(min_length=1, max_length=255)
    full_name: str = Field(min_length=1, max_length=500)
    email: str | None = Field(default=None, max_length=320)
    telegram_user_id: str | None = Field(default=None, min_length=1, max_length=64)
    role: UserRole = UserRole.USER
    is_active: bool = True


class UserUpdate(ORMModel):
    """Administrator-editable contact settings for an existing employee."""

    telegram_user_id: str | None = Field(default=None, min_length=1, max_length=64)


class UserVisibilityUpdate(ORMModel):
    """Administrator-managed data boundary for a KAM (UC-A-01)."""

    mode: UserVisibilityMode
    university_ids: list[uuid.UUID] = Field(default_factory=list)
