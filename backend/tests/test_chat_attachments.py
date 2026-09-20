"""Chat files use the same guarded storage path as workflow attachments."""

from __future__ import annotations

from app.core.access import AccessScope
from app.core.config import settings
from app.models.enums import AuditAction
from app.schemas.interaction import InteractionCreate
from app.schemas.university import UniversityCreate
from app.services.audit import search_audit_log
from app.services.catalogs import UniversityService
from app.services.interactions import InteractionService
from tests.conftest import auth
from tests.factories import ATTACHMENT_SAMPLES


async def test_chat_attachment_roundtrip_and_audit(
    session, client, manager_user, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "feature_chat_enabled", True)
    scope = AccessScope.system()
    university = await UniversityService(session, scope).create(UniversityCreate(name="Чат-вуз"))
    interaction = await InteractionService(session, scope).create(
        InteractionCreate(university_id=university.id)
    )

    uploaded = await client.post(
        f"/api/v1/interactions/{interaction.id}/messages/with-attachments",
        data={"body": "Посмотрите приложенный договор"},
        files={"files": ("договор.pdf", ATTACHMENT_SAMPLES["pdf"], "application/pdf")},
        headers=auth(manager_user),
    )
    assert uploaded.status_code == 201
    attachment = uploaded.json()["attachments"][0]
    assert attachment["file_format"] == "pdf"

    messages = await client.get(
        f"/api/v1/interactions/{interaction.id}/messages", headers=auth(manager_user)
    )
    assert messages.status_code == 200
    assert messages.json()[0]["attachments"][0]["id"] == attachment["id"]

    downloaded = await client.get(
        f"/api/v1/chat-attachments/{attachment['id']}/download", headers=auth(manager_user)
    )
    assert downloaded.status_code == 200
    assert downloaded.content == ATTACHMENT_SAMPLES["pdf"]

    _, total = await search_audit_log(
        session, entity_type="chat_attachments", action=AuditAction.EXPORT
    )
    assert total == 1


async def test_chat_attachment_is_hidden_with_its_card(
    session, client, manager_user, kam_user, monkeypatch
) -> None:
    monkeypatch.setattr(settings, "feature_chat_enabled", True)
    scope = AccessScope.system()
    university = await UniversityService(session, scope).create(
        UniversityCreate(name="Закрытый чат-вуз")
    )
    interaction = await InteractionService(session, scope).create(
        InteractionCreate(university_id=university.id)
    )
    uploaded = await client.post(
        f"/api/v1/interactions/{interaction.id}/messages/with-attachments",
        data={"body": "Закрытый файл"},
        files={"files": ("договор.pdf", ATTACHMENT_SAMPLES["pdf"], "application/pdf")},
        headers=auth(manager_user),
    )

    denied = await client.get(
        f"/api/v1/chat-attachments/{uploaded.json()['attachments'][0]['id']}/download",
        headers=auth(kam_user),
    )
    assert denied.status_code == 403
