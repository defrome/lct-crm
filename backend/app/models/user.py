"""Local projection of a Keycloak user (SPEC §4.2).

Keycloak stays the master; we keep just enough here to build foreign keys and
render full names in lists without a round-trip to the IdP.
"""

from __future__ import annotations

import uuid
from typing import ClassVar

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import DomainBase
from app.models.enums import (
    USER_ROLE_ENUM,
    USER_VISIBILITY_MODE_ENUM,
    UserRole,
    UserVisibilityMode,
)


class User(DomainBase):
    __tablename__ = "users"

    __pd_fields__: ClassVar[frozenset[str]] = frozenset({"full_name", "email", "telegram_user_id"})

    keycloak_id: Mapped[str] = mapped_column(sa.Text, nullable=False, unique=True)
    full_name: Mapped[str] = mapped_column(sa.Text, nullable=False)
    # Folded full name — the Excel "ФИО Менеджера" column is matched against it.
    full_name_normalized: Mapped[str] = mapped_column(sa.Text, nullable=False)
    email: Mapped[str | None] = mapped_column(sa.Text, default=None)
    # Telegram user/chat identifier used for direct notifications.  Kept as
    # text because Telegram IDs may exceed 32-bit integer range and can be
    # negative for group chats.
    telegram_user_id: Mapped[str | None] = mapped_column(sa.Text, default=None)
    role: Mapped[UserRole] = mapped_column(
        sa.Enum(UserRole, name=USER_ROLE_ENUM, values_callable=lambda e: [m.value for m in e]),
        nullable=False,
        default=UserRole.USER,
    )
    is_active: Mapped[bool] = mapped_column(
        sa.Boolean, nullable=False, default=True, server_default=sa.true()
    )
    # This setting applies only to the `user` (KAM) role. Managers and admins
    # retain their role-defined access to all data (FR-12).
    visibility_mode: Mapped[UserVisibilityMode] = mapped_column(
        sa.Enum(
            UserVisibilityMode,
            name=USER_VISIBILITY_MODE_ENUM,
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=UserVisibilityMode.ASSIGNMENTS,
        server_default=UserVisibilityMode.ASSIGNMENTS.value,
    )

    __table_args__ = (
        sa.Index("ix_users_full_name_normalized", "full_name_normalized"),
        sa.Index(
            "ix_users_full_name_normalized_trgm",
            "full_name_normalized",
            postgresql_using="gin",
            postgresql_ops={"full_name_normalized": "gin_trgm_ops"},
        ),
    )


class UserVisibilityUniversity(DomainBase):
    """An explicit university list maintained by an administrator (UC-A-01)."""

    __tablename__ = "user_visibility_universities"

    user_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    university_id: Mapped[uuid.UUID] = mapped_column(
        sa.ForeignKey("universities.id", ondelete="RESTRICT"), nullable=False
    )

    __table_args__ = (
        sa.UniqueConstraint("user_id", "university_id", name="user_visibility_university_unique"),
        sa.Index("ix_user_visibility_universities_user_id", "user_id"),
        sa.Index("ix_user_visibility_universities_university_id", "university_id"),
    )
