"""User projection service — used by seeds, assignments and the import matcher."""

from __future__ import annotations

import datetime as dt
import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access import AccessScope
from app.core.errors import DuplicateEntityError, ValidationError
from app.models.enums import UserRole, UserVisibilityMode
from app.models.university import University
from app.models.user import User, UserVisibilityUniversity
from app.repositories.user import UserRepository
from app.schemas.user import UserCreate, UserVisibilityUpdate
from app.services.base import integrity_guard
from app.services.text import clean_text, normalize_person_name


class UserService:
    def __init__(self, session: AsyncSession, scope: AccessScope | None = None) -> None:
        self.session = session
        self.scope = scope or AccessScope.system()
        self.repo = UserRepository(session, self.scope)

    async def list(
        self, *, page: int = 1, size: int = 50, search: str | None = None, sort: str | None = None
    ) -> tuple[list[User], int]:
        return await self.repo.list(page=page, size=size, search=search, sort=sort)

    async def get(self, user_id: uuid.UUID) -> User:
        return await self.repo.get_or_fail(user_id)

    async def create(self, data: UserCreate) -> User:
        full_name = clean_text(data.full_name)
        if not full_name:
            raise ValidationError("ФИО сотрудника не может быть пустым")
        if await self.repo.find_by_keycloak_id(data.keycloak_id):
            raise DuplicateEntityError(
                "Сотрудник с таким keycloak_id уже существует",
                details={"keycloak_id": data.keycloak_id},
            )
        user = User(
            keycloak_id=data.keycloak_id,
            full_name=full_name,
            full_name_normalized=normalize_person_name(full_name),
            email=clean_text(data.email),
            role=data.role,
            is_active=data.is_active,
        )
        self.repo.add(user)
        async with integrity_guard(
            self.session, duplicate_message="Сотрудник с таким keycloak_id уже существует"
        ):
            await self.session.flush()
            await self.session.commit()
        return user

    async def update_visibility(self, user_id: uuid.UUID, data: UserVisibilityUpdate) -> User:
        """Replace a KAM's explicit visibility policy atomically.

        `assignments` preserves the default access rule; `selected` replaces it
        with the administrator's list; `all` is useful for temporarily broad
        access without changing a manager role.  Role elevation still belongs
        to Keycloak, which remains the source of truth for roles.
        """
        user = await self.get(user_id)
        if user.role is not UserRole.USER:
            raise ValidationError(
                "Ограничения видимости настраиваются только для роли КАМ",
                details={"user_id": str(user_id), "role": user.role.value},
            )
        ids = list(dict.fromkeys(data.university_ids))
        if data.mode is UserVisibilityMode.SELECTED and not ids:
            raise ValidationError(
                "Для режима «Выбранные вузы» укажите хотя бы один вуз",
                details={"field": "university_ids"},
            )
        if ids:
            found = set(
                (
                    await self.session.scalars(
                        sa.select(University.id).where(
                            University.id.in_(ids), University.deleted_at.is_(None)
                        )
                    )
                ).all()
            )
            missing = [str(item) for item in ids if item not in found]
            if missing:
                raise ValidationError("В списке есть несуществующий вуз", details={"ids": missing})

        existing = list(
            (
                await self.session.scalars(
                    sa.select(UserVisibilityUniversity).where(
                        UserVisibilityUniversity.user_id == user.id
                    )
                )
            ).all()
        )
        existing_by_university = {item.university_id: item for item in existing}
        wanted = set(ids if data.mode is UserVisibilityMode.SELECTED else [])
        for university_id, item in existing_by_university.items():
            item.deleted_at = None if university_id in wanted else dt.datetime.now(dt.UTC)
        self.session.add_all(
            [
                UserVisibilityUniversity(user_id=user.id, university_id=university_id)
                for university_id in wanted - existing_by_university.keys()
            ]
        )
        user.visibility_mode = data.mode
        await self.session.flush()
        await self.session.commit()
        return user

    async def visibility(self, user_id: uuid.UUID) -> tuple[User, Sequence[uuid.UUID]]:
        user = await self.get(user_id)
        ids = list(
            (
                await self.session.scalars(
                    sa.select(UserVisibilityUniversity.university_id).where(
                        UserVisibilityUniversity.user_id == user.id,
                        UserVisibilityUniversity.deleted_at.is_(None),
                    )
                )
            ).all()
        )
        return user, ids

    async def match_by_full_name(self, full_name: str) -> User | None:
        """Resolve «ФИО Менеджера» from Excel to an employee.

        Returns ``None`` when nothing matches *or* when the name is ambiguous;
        the importer turns that into a warning and leaves the field empty
        (SPEC §6 step 3).
        """
        cleaned = clean_text(full_name)
        if not cleaned:
            return None
        return await self.repo.find_by_normalized_full_name(normalize_person_name(cleaned))
