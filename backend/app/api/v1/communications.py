"""HTTP endpoints for Track H communication and education modules."""

from __future__ import annotations

import asyncio
import contextlib
import uuid

from fastapi import APIRouter, Depends, status

from app.api.v1.deps import CurrentUserDep, ScopeDep, SessionDep
from app.core.config import settings
from app.core.security import CurrentUser, require_manager
from app.schemas.communications import (
    ActivityCreate,
    ActivityRead,
    ChatMessageCreate,
    ChatMessageRead,
    NotificationDeliveryRead,
    NotificationRuleCreate,
    NotificationRuleRead,
    ParticipantCreate,
    ParticipantRead,
)
from app.services.communications import CommunicationService, EducationService
from app.services.notification_worker import notification_loop

router = APIRouter(tags=["Коммуникации и обучение"])
_notification_task: asyncio.Task[None] | None = None


@router.on_event("startup")
async def start_notification_worker() -> None:
    global _notification_task
    if settings.feature_notifications_enabled:
        _notification_task = asyncio.create_task(notification_loop(), name="notification-worker")


@router.on_event("shutdown")
async def stop_notification_worker() -> None:
    global _notification_task
    if _notification_task is not None:
        _notification_task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await _notification_task
        _notification_task = None


@router.get(
    "/notification-rules",
    response_model=list[NotificationRuleRead],
    summary="Список правил уведомлений",
    description=(
        "Правила автоматических уведомлений для переходов workflow в доступных пользователю вузах."
    ),
)
async def rules(session: SessionDep, scope: ScopeDep) -> list[NotificationRuleRead]:
    return [
        NotificationRuleRead.model_validate(x)
        for x in await CommunicationService(session, scope).rules()
    ]


@router.post(
    "/notification-rules",
    response_model=NotificationRuleRead,
    status_code=status.HTTP_201_CREATED,
    summary="Создать правило уведомлений",
    description=(
        "Создаёт правило автоматического уведомления для перехода workflow. Доступно менеджеру."
    ),
)
async def create_rule(
    data: NotificationRuleCreate,
    session: SessionDep,
    scope: ScopeDep,
    _: CurrentUser = Depends(require_manager),
) -> NotificationRuleRead:
    return NotificationRuleRead.model_validate(
        await CommunicationService(session, scope).create_rule(data.model_dump())
    )


@router.post(
    "/notifications/run-stalled",
    summary="Проверить просроченные переходы",
    description=(
        "Создаёт ожидающие уведомления для карточек с просроченными переходами workflow. "
        "Доступно менеджеру."
    ),
)
async def run_stalled(
    session: SessionDep, scope: ScopeDep, _: CurrentUser = Depends(require_manager)
) -> dict[str, int]:
    return {"created": await CommunicationService(session, scope).check_stalled()}


@router.post(
    "/notifications/deliver",
    summary="Отправить ожидающие уведомления",
    description="Обрабатывает очередь ожидающих уведомлений. Доступно менеджеру.",
)
async def deliver(
    session: SessionDep, scope: ScopeDep, _: CurrentUser = Depends(require_manager)
) -> dict[str, int]:
    return {"processed": await CommunicationService(session, scope).deliver_pending()}


@router.get(
    "/notifications",
    response_model=list[NotificationDeliveryRead],
    summary="Notification delivery list",
    description="Returns notification deliveries available to the current user.",
)
async def notification_deliveries(
    session: SessionDep, scope: ScopeDep
) -> list[NotificationDeliveryRead]:
    return [
        NotificationDeliveryRead.model_validate(item)
        for item in await CommunicationService(session, scope).deliveries()
    ]


@router.get(
    "/interactions/{interaction_id}/messages",
    response_model=list[ChatMessageRead],
    summary="Сообщения по взаимодействию",
    description="Возвращает историю сообщений для указанного взаимодействия.",
)
async def messages(
    interaction_id: uuid.UUID, session: SessionDep, scope: ScopeDep
) -> list[ChatMessageRead]:
    return [
        ChatMessageRead.model_validate(x)
        for x in await CommunicationService(session, scope).messages(interaction_id)
    ]


@router.post(
    "/interactions/{interaction_id}/messages",
    response_model=ChatMessageRead,
    status_code=status.HTTP_201_CREATED,
    summary="Добавить сообщение по взаимодействию",
    description="Добавляет сообщение от текущего пользователя к указанному взаимодействию.",
)
async def message(
    interaction_id: uuid.UUID,
    data: ChatMessageCreate,
    session: SessionDep,
    scope: ScopeDep,
    user: CurrentUserDep,
) -> ChatMessageRead:
    return ChatMessageRead.model_validate(
        await CommunicationService(session, scope).post_message(interaction_id, user.id, data.body)
    )


@router.get(
    "/education/participants",
    response_model=list[ParticipantRead],
    summary="Список участников образовательных активностей",
    description="Возвращает участников образовательных активностей в доступных пользователю вузах.",
)
async def participants(session: SessionDep, scope: ScopeDep) -> list[ParticipantRead]:
    return [
        ParticipantRead.model_validate(x)
        for x in await EducationService(session, scope).participants()
    ]


@router.post(
    "/education/participants",
    response_model=ParticipantRead,
    status_code=status.HTTP_201_CREATED,
    summary="Добавить участника образовательной активности",
    description="Создаёт участника образовательных активностей. Доступно менеджеру.",
)
async def participant(
    data: ParticipantCreate,
    session: SessionDep,
    scope: ScopeDep,
    _: CurrentUser = Depends(require_manager),
) -> ParticipantRead:
    return ParticipantRead.model_validate(
        await EducationService(session, scope).create_participant(data.model_dump())
    )


@router.get(
    "/education/activities",
    response_model=list[ActivityRead],
    summary="Список образовательных активностей",
    description="Возвращает образовательные активности вместе с их участниками.",
)
async def activities(session: SessionDep, scope: ScopeDep) -> list[ActivityRead]:
    return [
        ActivityRead(
            id=a.id,
            university_id=a.university_id,
            name=a.name,
            federal_project=a.federal_project,
            starts_at=a.starts_at,
            ends_at=a.ends_at,
            participants=[ParticipantRead.model_validate(p) for p in people],
        )
        for a, people in await EducationService(session, scope).activities()
    ]


@router.post(
    "/education/activities",
    response_model=ActivityRead,
    status_code=status.HTTP_201_CREATED,
    summary="Создать образовательную активность",
    description=(
        "Создаёт образовательную активность и связывает её с указанными участниками. "
        "Доступно менеджеру."
    ),
)
async def activity(
    data: ActivityCreate,
    session: SessionDep,
    scope: ScopeDep,
    _: CurrentUser = Depends(require_manager),
) -> ActivityRead:
    a = await EducationService(session, scope).create_activity(data.model_dump())
    people = [
        p
        for activity_, people_ in await EducationService(session, scope).activities()
        if activity_.id == a.id
        for p in people_
    ]
    return ActivityRead(
        id=a.id,
        university_id=a.university_id,
        name=a.name,
        federal_project=a.federal_project,
        starts_at=a.starts_at,
        ends_at=a.ends_at,
        participants=[ParticipantRead.model_validate(p) for p in people],
    )
