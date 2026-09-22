from __future__ import annotations

import uuid

import httpx
import sqlalchemy as sa

from app.core.config import settings
from app.models.communications import NotificationDelivery, NotificationRule
from app.services.communications import CommunicationService
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


async def test_telegram_delivery_uses_recipient_personal_id(monkeypatch):
    """A responsible user's Telegram ID must override the global chat setting."""

    recipient_id = uuid.uuid4()

    class FakeSession:
        async def scalar(self, statement):
            # The delivery service resolves User.telegram_user_id from this query.
            return "987654321"

    sent: dict[str, object] = {}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def post(self, url, *, json):
            sent.update(url=url, json=json)
            return httpx.Response(200, json={"ok": True})

    monkeypatch.setattr(settings, "feature_external_channels_enabled", True)
    monkeypatch.setattr(settings, "telegram_bot_token", "test-token")
    monkeypatch.setattr(settings, "telegram_chat_id", "global-chat")
    monkeypatch.setattr("app.services.communications.httpx.AsyncClient", FakeClient)

    row = NotificationDelivery(
        rule_id=uuid.uuid4(),
        interaction_id=uuid.uuid4(),
        university_id=uuid.uuid4(),
        recipient_user_id=recipient_id,
        channel="telegram",
        dedupe_key="telegram-test",
        payload={"event": "transition:test", "card": {}},
    )
    service = CommunicationService(FakeSession())
    service._notification_message = lambda _row: _async_message()  # type: ignore[method-assign]
    ok, error = await service._deliver(row)

    assert ok is True
    assert error is None
    assert sent["json"] == {"chat_id": "987654321", "text": "test message"}


async def test_telegram_delivery_requires_recipient_or_global_chat(monkeypatch):
    class FakeSession:
        async def scalar(self, statement):
            return None

    monkeypatch.setattr(settings, "feature_external_channels_enabled", True)
    monkeypatch.setattr(settings, "telegram_bot_token", "test-token")
    monkeypatch.setattr(settings, "telegram_chat_id", None)

    row = NotificationDelivery(
        rule_id=uuid.uuid4(),
        interaction_id=uuid.uuid4(),
        university_id=uuid.uuid4(),
        recipient_user_id=uuid.uuid4(),
        channel="telegram",
        dedupe_key="telegram-missing-id",
        payload={"event": "notification", "card": {}},
    )
    ok, error = await CommunicationService(FakeSession())._deliver(row)

    assert ok is False
    assert error == "У получателя не указан Telegram ID"


async def _async_message() -> str:
    return "test message"
