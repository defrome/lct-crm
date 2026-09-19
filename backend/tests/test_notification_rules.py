from __future__ import annotations

import sqlalchemy as sa

from app.models.communications import NotificationRule
from tests.conftest import auth


async def test_manager_can_soft_delete_notification_rule(session, client, manager_user):
    created = await client.post(
        "/api/v1/notification-rules",
        json={
            "stale_after_days": 14,
            "recipient_kind": "responsible",
            "channel": "email",
        },
        headers=auth(manager_user),
    )
    assert created.status_code == 201
    rule_id = created.json()["id"]

    removed = await client.delete(
        f"/api/v1/notification-rules/{rule_id}", headers=auth(manager_user)
    )

    assert removed.status_code == 204
    listed = await client.get("/api/v1/notification-rules", headers=auth(manager_user))
    assert listed.status_code == 200
    assert listed.json() == []
    deleted_at = await session.scalar(
        sa.select(NotificationRule.deleted_at).where(NotificationRule.id == rule_id)
    )
    assert deleted_at is not None


async def test_notification_rule_delete_requires_manager(client, kam_user):
    response = await client.delete(
        "/api/v1/notification-rules/00000000-0000-0000-0000-000000000000",
        headers=auth(kam_user),
    )

    assert response.status_code == 403


async def test_deleting_missing_notification_rule_returns_not_found(client, manager_user):
    response = await client.delete(
        "/api/v1/notification-rules/00000000-0000-0000-0000-000000000000",
        headers=auth(manager_user),
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "NOT_FOUND"
