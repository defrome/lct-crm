"""Administrator-configured KAM visibility rules (UC-A-01)."""

from __future__ import annotations

import datetime as dt

import pytest

from app.core.access import AccessScope
from app.core.errors import ValidationError
from app.schemas.university import AssignmentCreate, UniversityCreate
from app.schemas.user import UserVisibilityUpdate
from app.services.assignments import AssignmentService
from app.services.catalogs import UniversityService
from app.services.users import UserService
from tests.conftest import auth


async def test_selected_visibility_overrides_assignments(session, kam_user):
    universities = UniversityService(session, AccessScope.system())
    assigned = await universities.create(UniversityCreate(name="Закреплённый вуз"))
    selected = await universities.create(UniversityCreate(name="Явно выбранный вуз"))
    await AssignmentService(session, AccessScope.system()).create(
        assigned.id,
        AssignmentCreate(user_id=kam_user.id, assigned_from=dt.date.today()),
    )

    users = UserService(session, AccessScope.system())
    await users.update_visibility(
        kam_user.id,
        UserVisibilityUpdate(mode="selected", university_ids=[selected.id]),
    )

    scoped = UniversityService(
        session,
        AccessScope(user_id=kam_user.id, is_privileged=False, visibility_mode="selected"),
    )
    items, total = await scoped.list()
    assert total == 1
    assert [item.id for item in items] == [selected.id]


async def test_all_visibility_allows_every_university(session, kam_user):
    universities = UniversityService(session, AccessScope.system())
    await universities.create(UniversityCreate(name="Первый вуз"))
    await universities.create(UniversityCreate(name="Второй вуз"))

    await UserService(session, AccessScope.system()).update_visibility(
        kam_user.id,
        UserVisibilityUpdate(mode="all"),
    )

    scoped = UniversityService(
        session,
        AccessScope(user_id=kam_user.id, is_privileged=False, visibility_mode="all"),
    )
    _, total = await scoped.list()
    assert total == 2


async def test_visibility_is_only_for_kams(session, manager_user, scope):
    with pytest.raises(ValidationError):
        await UserService(session, scope).update_visibility(
            manager_user.id,
            UserVisibilityUpdate(mode="all"),
        )


async def test_visibility_api_is_admin_only(session, client, admin_user, kam_user):
    denied = await client.get(f"/api/v1/users/{kam_user.id}/visibility", headers=auth(kam_user))
    assert denied.status_code == 403

    updated = await client.patch(
        f"/api/v1/users/{kam_user.id}/visibility",
        json={"mode": "all", "university_ids": []},
        headers=auth(admin_user),
    )
    assert updated.status_code == 200
    assert updated.json()["visibility_mode"] == "all"
