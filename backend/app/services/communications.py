"""Track H application services. Delivery is an outbox: card changes never wait for a channel."""

from __future__ import annotations

import asyncio
import datetime as dt
import email.message
import hashlib
import smtplib
import ssl
import uuid
from typing import Any, cast

import httpx
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access import AccessScope
from app.core.config import settings
from app.core.errors import (
    AttachmentTooLargeError,
    DuplicateEntityError,
    NotFoundError,
    ValidationError,
)
from app.models.communications import (
    ChatAttachment,
    ChatMessage,
    EducationActivity,
    EducationActivityParticipant,
    EducationParticipant,
    NotificationDelivery,
    NotificationRule,
)
from app.models.enums import AttachmentFormat
from app.models.interaction import Interaction
from app.models.product import ITDirection, ITProduct
from app.models.university import University
from app.models.user import User
from app.models.workflow import WorkflowStage
from app.repositories.interaction import InteractionRepository
from app.services.audit import log_export
from app.services.base import integrity_guard
from app.services.file_types import detect_attachment_format
from app.services.object_storage import ObjectStorage, get_object_storage
from app.services.text import clean_text


def _send_email(
    host: str,
    port: int,
    username: str | None,
    password: str | None,
    sender: str,
    recipient: str,
    body: str,
    use_tls: bool,
    use_ssl: bool,
) -> None:
    message = email.message.EmailMessage()
    message["From"], message["To"], message["Subject"] = sender, recipient, "CRM уведомление"
    message.set_content(body)
    smtp_class: type[smtplib.SMTP] = smtplib.SMTP_SSL if use_ssl else smtplib.SMTP
    with smtp_class(host, port, timeout=15) as smtp:
        if use_tls:
            smtp.starttls(context=ssl.create_default_context())
        if username:
            smtp.login(username, password or "")
        smtp.send_message(message)


def _visible(
    scope: AccessScope,
    model: type[EducationParticipant] | type[EducationActivity] | type[NotificationDelivery],
) -> Any:
    from app.repositories.base import visible_university_ids

    if scope.is_privileged or scope.visibility_mode == "all":
        return sa.true()
    return model.university_id.in_(visible_university_ids(scope))


class CommunicationService:
    def __init__(self, session: AsyncSession, scope: AccessScope | None = None) -> None:
        self.session, self.scope = session, scope or AccessScope.system()
        self.interactions = InteractionRepository(session, self.scope)

    async def rules(self) -> list[NotificationRule]:
        return list(
            (
                await self.session.scalars(
                    sa.select(NotificationRule)
                    .where(NotificationRule.deleted_at.is_(None))
                    .order_by(NotificationRule.created_at)
                )
            ).all()
        )

    async def create_rule(self, data: dict[str, object]) -> NotificationRule:
        # A reminder rule inherits the agreed 14-day threshold unless the
        # administrator chooses another value. Transition rules have no timer.
        if data.get("workflow_transition_id") is None and data.get("stale_after_days") is None:
            data["stale_after_days"] = 14
        transition_id, stale_days = data.get("workflow_transition_id"), data.get("stale_after_days")
        if bool(transition_id) == bool(stale_days):
            raise ValidationError("Правило задаётся либо для перехода, либо для зависшей карточки")
        recipient = data.get("recipient_kind")
        if recipient == "role" and not data.get("recipient_role"):
            raise ValidationError("Для получателя-роля укажите recipient_role")
        if recipient == "user" and not data.get("recipient_user_id"):
            raise ValidationError("Для конкретного получателя укажите recipient_user_id")
        duplicate_filters = [
            NotificationRule.recipient_kind == recipient,
            NotificationRule.recipient_role.is_not_distinct_from(data.get("recipient_role")),
            NotificationRule.recipient_user_id.is_not_distinct_from(data.get("recipient_user_id")),
            NotificationRule.channel == data.get("channel"),
            NotificationRule.is_enabled.is_(True),
            NotificationRule.deleted_at.is_(None),
        ]
        if transition_id is not None:
            duplicate_filters.extend(
                [
                    NotificationRule.workflow_transition_id == transition_id,
                    NotificationRule.stale_after_days.is_(None),
                ]
            )
        else:
            duplicate_filters.extend(
                [
                    NotificationRule.workflow_transition_id.is_(None),
                    NotificationRule.stale_after_days == stale_days,
                ]
            )
        duplicate = await self.session.scalar(
            sa.select(NotificationRule.id).where(*duplicate_filters)
        )
        if duplicate is not None:
            raise DuplicateEntityError(
                "Такое правило уведомлений уже существует",
                details={"rule_id": str(duplicate)},
            )
        rule = NotificationRule(**data)
        self.session.add(rule)
        async with integrity_guard(
            self.session,
            duplicate_message="Такое правило уведомлений уже существует",
        ):
            await self.session.flush()
            await self.session.commit()
        return rule

    async def delete_rule(self, rule_id: uuid.UUID) -> None:
        rule = await self.session.scalar(
            sa.select(NotificationRule).where(
                NotificationRule.id == rule_id,
                NotificationRule.deleted_at.is_(None),
            )
        )
        if rule is None:
            raise NotFoundError(
                "Правило уведомлений не найдено",
                details={"entity_type": NotificationRule.__tablename__, "id": str(rule_id)},
            )
        rule.deleted_at = dt.datetime.now(dt.UTC)
        await self.session.commit()

    async def enqueue_transition(self, interaction: Interaction, transition_id: uuid.UUID) -> None:
        if not settings.feature_notifications_enabled:
            return
        rules = list(
            (
                await self.session.scalars(
                    sa.select(NotificationRule).where(
                        NotificationRule.workflow_transition_id == transition_id,
                        NotificationRule.is_enabled.is_(True),
                        NotificationRule.deleted_at.is_(None),
                    )
                )
            ).all()
        )
        for rule in rules:
            await self._enqueue(rule, interaction, f"transition:{transition_id}")

    async def _recipients(
        self, rule: NotificationRule, interaction: Interaction
    ) -> list[uuid.UUID | None]:
        if rule.recipient_kind == "responsible":
            return [interaction.responsible_user_id] if interaction.responsible_user_id else []
        if rule.recipient_kind == "manager":
            # A manager hierarchy has not been agreed; privileged users are a safe fallback.
            return list(
                (
                    await self.session.scalars(
                        sa.select(User.id).where(
                            User.role.in_(("manager", "admin")),
                            User.is_active.is_(True),
                            User.deleted_at.is_(None),
                        )
                    )
                ).all()
            )
        if rule.recipient_kind == "role":
            return list(
                (
                    await self.session.scalars(
                        sa.select(User.id).where(
                            User.role == rule.recipient_role,
                            User.is_active.is_(True),
                            User.deleted_at.is_(None),
                        )
                    )
                ).all()
            )
        return [rule.recipient_user_id] if rule.recipient_user_id else []

    async def _enqueue(self, rule: NotificationRule, interaction: Interaction, event: str) -> None:
        for recipient_id in await self._recipients(rule, interaction):
            key = f"{rule.id}:{interaction.id}:{event}:{recipient_id or 'none'}"
            exists = await self.session.scalar(
                sa.select(NotificationDelivery.id).where(NotificationDelivery.dedupe_key == key)
            )
            if exists is None:
                self.session.add(
                    NotificationDelivery(
                        rule_id=rule.id,
                        interaction_id=interaction.id,
                        university_id=interaction.university_id,
                        recipient_user_id=recipient_id,
                        channel=rule.channel,
                        dedupe_key=key,
                        payload={
                            "event": event,
                            "interaction_id": str(interaction.id),
                            "card": await self._card_snapshot(interaction.id),
                            "stale_after_days": rule.stale_after_days,
                        },
                    )
                )

    async def _card_snapshot(self, interaction_id: uuid.UUID) -> dict[str, str | None]:
        """Capture card names for a notification instead of exposing internal UUIDs."""
        row = await self.session.execute(
            sa.select(
                University.name,
                ITDirection.name,
                ITProduct.name,
                User.full_name,
                WorkflowStage.name,
            )
            .select_from(Interaction)
            .join(University, Interaction.university_id == University.id)
            .outerjoin(ITDirection, Interaction.it_direction_id == ITDirection.id)
            .outerjoin(ITProduct, Interaction.it_product_id == ITProduct.id)
            .outerjoin(User, Interaction.responsible_user_id == User.id)
            .outerjoin(WorkflowStage, Interaction.current_stage_id == WorkflowStage.id)
            .where(Interaction.id == interaction_id)
        )
        card = row.one_or_none()
        if card is None:
            return {}
        return {
            "university": card[0],
            "direction": card[1],
            "product": card[2],
            "responsible": card[3],
            "stage": card[4],
        }

    async def _notification_message(self, row: NotificationDelivery) -> str:
        payload = row.payload or {}
        event = str(payload.get("event", "notification"))
        card = payload.get("card")
        # Deliveries already queued before this format was added also receive
        # readable text if they are retried.
        if not isinstance(card, dict):
            card = await self._card_snapshot(row.interaction_id)

        def value(key: str, fallback: str = "не указано") -> str:
            item = card.get(key) if isinstance(card, dict) else None
            return str(item) if item else fallback

        if event.startswith("stalled:"):
            days = payload.get("stale_after_days")
            headline = (
                f"Карточка не менялась более {days} дн."
                if isinstance(days, int)
                else "Карточка давно не менялась."
            )
            title = "CRM — напоминание"
        elif event.startswith("transition:"):
            headline = f"Карточка переведена на этап «{value('stage')}»."
            title = "CRM — изменение карточки"
        else:
            headline = "Есть обновление по карточке."
            title = "CRM — уведомление"

        lines = [
            title,
            "",
            headline,
            f"Вуз: {value('university')}",
            f"Направление: {value('direction')}",
            f"Продукт: {value('product')}",
            f"Текущий этап: {value('stage')}",
        ]
        responsible = value("responsible", "")
        if responsible:
            lines.append(f"Ответственный: {responsible}")
        return "\n".join(lines)

    async def check_stalled(self, now: dt.datetime | None = None) -> int:
        if not settings.feature_notifications_enabled:
            return 0
        now = now or dt.datetime.now(dt.UTC)
        rules = list(
            (
                await self.session.scalars(
                    sa.select(NotificationRule).where(
                        NotificationRule.stale_after_days.is_not(None),
                        NotificationRule.is_enabled.is_(True),
                        NotificationRule.deleted_at.is_(None),
                    )
                )
            ).all()
        )
        created = 0
        for rule in rules:
            cutoff = now - dt.timedelta(days=rule.stale_after_days or 14)
            cards = list(
                (
                    await self.session.scalars(
                        sa.select(Interaction).where(
                            Interaction.current_stage_id.is_not(None),
                            Interaction.updated_at < cutoff,
                            Interaction.deleted_at.is_(None),
                        )
                    )
                ).all()
            )
            before = len(self.session.new)
            for card in cards:
                await self._enqueue(rule, card, f"stalled:{card.current_stage_id}")
            created += max(0, len(self.session.new) - before)
        await self.session.commit()
        return created

    async def deliver_pending(self) -> int:
        """Attempt queued notifications; unavailable external channels are retried later."""
        rows = list(
            (
                await self.session.scalars(
                    sa.select(NotificationDelivery)
                    .where(
                        NotificationDelivery.status.in_(("queued", "failed")),
                        NotificationDelivery.deleted_at.is_(None),
                    )
                    .order_by(NotificationDelivery.created_at)
                    .limit(100)
                )
            ).all()
        )
        for row in rows:
            row.attempts += 1
            ok, error = await self._deliver(row)
            if ok:
                row.status, row.sent_at, row.error_message = "sent", dt.datetime.now(dt.UTC), None
            else:
                row.status, row.error_message = "failed", error
        await self.session.commit()
        return len(rows)

    async def _deliver(self, row: NotificationDelivery) -> tuple[bool, str | None]:
        if not settings.feature_external_channels_enabled:
            return False, "Внешние каналы отключены: включите FEATURE_EXTERNAL_CHANNELS_ENABLED"
        event = str((row.payload or {}).get("event", "уведомление"))
        message = f"CRM: {event} (карточка {row.interaction_id})"
        message = await self._notification_message(row) or message
        if row.channel == "email":
            if not settings.smtp_host or not settings.smtp_from:
                return False, "Email не настроен: укажите SMTP_HOST и SMTP_FROM"
            recipient_email = await self.session.scalar(
                sa.select(User.email).where(
                    User.id == row.recipient_user_id, User.deleted_at.is_(None)
                )
            )
            if not recipient_email:
                return False, "У получателя не указан рабочий email"
            try:
                await asyncio.to_thread(
                    _send_email,
                    settings.smtp_host,
                    settings.smtp_port,
                    settings.smtp_username,
                    settings.smtp_password,
                    settings.smtp_from,
                    recipient_email,
                    message,
                    settings.smtp_use_tls,
                    settings.smtp_use_ssl,
                )
            except Exception as exc:  # pragma: no cover - external SMTP failure
                return False, f"Ошибка SMTP: {exc}"
            return True, None
        if row.channel == "telegram":
            if not settings.telegram_bot_token:
                return False, "Telegram не настроен: укажите TELEGRAM_BOT_TOKEN"
            # Resolve a personal destination for responsible/explicit user
            # recipients.  The global chat ID is only a fallback for system
            # deliveries without a user recipient; never leak a reminder for
            # one responsible person to another chat.
            if row.recipient_user_id is not None:
                recipient_chat_id = await self.session.scalar(
                    sa.select(User.telegram_user_id).where(
                        User.id == row.recipient_user_id,
                        User.deleted_at.is_(None),
                        User.is_active.is_(True),
                    )
                )
            else:
                recipient_chat_id = settings.telegram_chat_id
            if not recipient_chat_id:
                return False, "У получателя не указан Telegram ID"
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    response = await client.post(
                        f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage",
                        json={"chat_id": recipient_chat_id, "text": message},
                    )
                    # Check the status code directly instead of calling
                    # ``raise_for_status``: lightweight clients (and tests)
                    # may return a response without an attached request.
                    if response.status_code >= 400:
                        return False, f"Telegram HTTP {response.status_code}"
            except Exception as exc:  # pragma: no cover - external Telegram failure
                return False, f"Ошибка Telegram: {exc}"
            return True, None
        return False, "Канал MAX пока не подключён"

    async def deliveries(self, limit: int = 20) -> list[NotificationDelivery]:
        """Recent delivery attempts for the notification center."""
        return list(
            (
                await self.session.scalars(
                    sa.select(NotificationDelivery)
                    .where(
                        NotificationDelivery.deleted_at.is_(None),
                        _visible(self.scope, NotificationDelivery),
                        sa.or_(
                            NotificationDelivery.recipient_user_id == self.scope.user_id,
                            NotificationDelivery.recipient_user_id.is_(None),
                        ),
                    )
                    .order_by(NotificationDelivery.created_at.desc())
                    .limit(limit)
                )
            ).all()
        )

    async def mark_delivery_read(self, delivery_id: uuid.UUID) -> None:
        """Hide one notification from the current user's notification center."""
        row = await self.session.scalar(
            sa.select(NotificationDelivery).where(
                NotificationDelivery.id == delivery_id,
                NotificationDelivery.deleted_at.is_(None),
                _visible(self.scope, NotificationDelivery),
                sa.or_(
                    NotificationDelivery.recipient_user_id == self.scope.user_id,
                    NotificationDelivery.recipient_user_id.is_(None),
                ),
            )
        )
        if row is None:
            raise NotFoundError("Уведомление не найдено")
        row.deleted_at = dt.datetime.now(dt.UTC)
        await self.session.commit()

    async def messages(self, interaction_id: uuid.UUID) -> list[ChatMessage]:
        await self.interactions.get_or_fail(interaction_id)
        return list(
            (
                await self.session.scalars(
                    sa.select(ChatMessage)
                    .where(
                        ChatMessage.interaction_id == interaction_id,
                        ChatMessage.deleted_at.is_(None),
                    )
                    .order_by(ChatMessage.created_at)
                )
            ).all()
        )

    async def post_message(
        self, interaction_id: uuid.UUID, author_id: uuid.UUID, body: str
    ) -> ChatMessage:
        interaction = await self.interactions.get_or_fail(interaction_id)
        if not settings.feature_chat_enabled:
            raise ValidationError("Чат отключён feature flag")
        message = ChatMessage(
            interaction_id=interaction.id,
            university_id=interaction.university_id,
            author_id=author_id,
            body=clean_text(body) or "",
        )
        self.session.add(message)
        await self.session.commit()
        return await self.session.scalar(sa.select(ChatMessage).where(ChatMessage.id == message.id))  # type: ignore[return-value]

    async def post_message_with_attachments(
        self,
        interaction_id: uuid.UUID,
        author_id: uuid.UUID,
        body: str,
        files: list[tuple[str, bytes]],
        *,
        storage: ObjectStorage | None = None,
    ) -> ChatMessage:
        """Create one message and its files as a single database operation."""
        interaction = await self.interactions.get_or_fail(interaction_id)
        if not settings.feature_chat_enabled:
            raise ValidationError("Чат отключён feature flag")
        cleaned_body = clean_text(body) or ""
        if not cleaned_body and not files:
            raise ValidationError("Добавьте текст сообщения или хотя бы один файл")
        if len(files) > 10:
            raise ValidationError("К одному сообщению можно приложить не больше 10 файлов")

        prepared: list[tuple[str, bytes, AttachmentFormat, str]] = []
        for filename, content in files:
            if len(content) > settings.attachment_max_file_size:
                raise AttachmentTooLargeError(
                    "Размер файла превышает допустимый предел",
                    details={"filename": filename, "max_size": settings.attachment_max_file_size},
                )
            cleaned_name = clean_text(filename) or "file"
            file_format, content_type = detect_attachment_format(content, cleaned_name)
            prepared.append((cleaned_name, content, file_format, content_type))

        message = ChatMessage(
            interaction_id=interaction.id,
            university_id=interaction.university_id,
            author_id=author_id,
            body=cleaned_body,
        )
        self.session.add(message)
        await self.session.flush()
        attachments: list[tuple[ChatAttachment, bytes]] = []
        for filename, content, file_format, content_type in prepared:
            attachment = ChatAttachment(
                message_id=message.id,
                interaction_id=interaction.id,
                university_id=interaction.university_id,
                filename=filename,
                file_format=file_format,
                content_type=content_type,
                size_bytes=len(content),
                file_hash=hashlib.sha256(content).hexdigest(),
            )
            self.session.add(attachment)
            await self.session.flush()
            attachment.storage_key = f"chat-attachments/{attachment.id}"
            attachments.append((attachment, content))

        object_storage = storage or get_object_storage()
        written_keys: list[str] = []
        try:
            for attachment, content in attachments:
                assert attachment.storage_key is not None
                await object_storage.put(attachment.storage_key, content, attachment.content_type)
                written_keys.append(attachment.storage_key)
            await self.session.commit()
        except Exception:
            await self.session.rollback()
            for key in written_keys:
                await object_storage.delete(key)
            raise
        return await self.session.scalar(sa.select(ChatMessage).where(ChatMessage.id == message.id))  # type: ignore[return-value]

    async def download_chat_attachment(
        self, attachment_id: uuid.UUID, *, storage: ObjectStorage | None = None
    ) -> tuple[ChatAttachment, bytes]:
        attachment = await self.session.scalar(
            sa.select(ChatAttachment).where(
                ChatAttachment.id == attachment_id, ChatAttachment.deleted_at.is_(None)
            )
        )
        if attachment is None:
            raise NotFoundError()
        # This is deliberately the same visibility check as reading the message list.
        await self.interactions.get_or_fail(attachment.interaction_id)
        data = await (storage or get_object_storage()).get(attachment.storage_key or "")
        if data is None:
            raise NotFoundError("Содержимое файла не найдено")
        await log_export(
            self.session,
            entity_type="chat_attachments",
            entity_id=attachment.id,
            filename=attachment.filename,
            size=attachment.size_bytes,
        )
        await self.session.commit()
        return attachment, data


class EducationService:
    def __init__(self, session: AsyncSession, scope: AccessScope | None = None) -> None:
        self.session, self.scope = session, scope or AccessScope.system()

    async def participants(self) -> list[EducationParticipant]:
        return list(
            (
                await self.session.scalars(
                    sa.select(EducationParticipant)
                    .where(
                        EducationParticipant.deleted_at.is_(None),
                        _visible(self.scope, EducationParticipant),
                    )
                    .order_by(EducationParticipant.full_name)
                )
            ).all()
        )

    async def create_participant(self, data: dict[str, object]) -> EducationParticipant:
        item = EducationParticipant(**data)
        self.session.add(item)
        await self.session.commit()
        return item

    async def create_activity(self, data: dict[str, object]) -> EducationActivity:
        ids = cast(list[uuid.UUID], data.pop("participant_ids", []))
        activity = EducationActivity(**data)
        self.session.add(activity)
        await self.session.flush()
        participants = (
            list(
                (
                    await self.session.scalars(
                        sa.select(EducationParticipant).where(
                            EducationParticipant.id.in_(ids),
                            EducationParticipant.deleted_at.is_(None),
                            _visible(self.scope, EducationParticipant),
                        )
                    )
                ).all()
            )
            if ids
            else []
        )
        if len(participants) != len(ids):
            raise ValidationError("Часть участников недоступна или не существует")
        if activity.university_id and any(
            p.university_id != activity.university_id for p in participants
        ):
            raise ValidationError("Участники активности должны относиться к тому же вузу")
        self.session.add_all(
            [
                EducationActivityParticipant(activity_id=activity.id, participant_id=p.id)
                for p in participants
            ]
        )
        await self.session.commit()
        return activity

    async def activities(self) -> list[tuple[EducationActivity, list[EducationParticipant]]]:
        rows = list(
            (
                await self.session.scalars(
                    sa.select(EducationActivity)
                    .where(
                        EducationActivity.deleted_at.is_(None),
                        sa.or_(
                            EducationActivity.university_id.is_(None),
                            _visible(self.scope, EducationActivity),
                        ),
                    )
                    .order_by(EducationActivity.starts_at)
                )
            ).all()
        )
        result = []
        for row in rows:
            people = list(
                (
                    await self.session.scalars(
                        sa.select(EducationParticipant)
                        .join(
                            EducationActivityParticipant,
                            EducationActivityParticipant.participant_id == EducationParticipant.id,
                        )
                        .where(
                            EducationActivityParticipant.activity_id == row.id,
                            EducationActivityParticipant.deleted_at.is_(None),
                            EducationParticipant.deleted_at.is_(None),
                            _visible(self.scope, EducationParticipant),
                        )
                    )
                ).all()
            )
            result.append((row, people))
        return result
