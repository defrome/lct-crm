"""Track H application services. Delivery is an outbox: card changes never wait for a channel."""

from __future__ import annotations

import asyncio
import datetime as dt
import email.message
import smtplib
import uuid
from typing import Any, cast

import httpx
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access import AccessScope
from app.core.config import settings
from app.core.errors import DuplicateEntityError, ValidationError
from app.models.communications import (
    ChatMessage,
    EducationActivity,
    EducationActivityParticipant,
    EducationParticipant,
    NotificationDelivery,
    NotificationRule,
)
from app.models.interaction import Interaction
from app.models.user import User
from app.repositories.interaction import InteractionRepository
from app.services.base import integrity_guard
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
) -> None:
    message = email.message.EmailMessage()
    message["From"], message["To"], message["Subject"] = sender, recipient, "CRM уведомление"
    message.set_content(body)
    with smtplib.SMTP(host, port, timeout=15) as smtp:
        if use_tls:
            smtp.starttls()
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
                        payload={"event": event, "interaction_id": str(interaction.id)},
                    )
                )

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
                )
            except Exception as exc:  # pragma: no cover - external SMTP failure
                return False, f"Ошибка SMTP: {exc}"
            return True, None
        if row.channel == "telegram":
            if not settings.telegram_bot_token or not settings.telegram_chat_id:
                return False, "Telegram не настроен: укажите TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID"
            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    response = await client.post(
                        f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage",
                        json={"chat_id": settings.telegram_chat_id, "text": message},
                    )
                    response.raise_for_status()
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
                    )
                    .order_by(NotificationDelivery.created_at.desc())
                    .limit(limit)
                )
            ).all()
        )

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
