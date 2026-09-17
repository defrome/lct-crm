"""Integration endpoints: what is wired up, and running a sync (SPEC-04)."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query, status

from app.api.v1.deps import (
    READ_ERRORS,
    PaginationDep,
    ScopeDep,
    SessionDep,
    SortQuery,
    error_responses,
)
from app.core.errors import ErrorCode
from app.core.security import CurrentUser, require_manager
from app.integrations.ingest import IntegrationService, describe_sources
from app.models.enums import IntegrationSource
from app.schemas.common import Page
from app.schemas.integration import (
    IntegrationSyncRunRead,
    IntegrationSyncStats,
    SourceDescription,
    SyncRequest,
    SyncResult,
)

router = APIRouter(prefix="/integrations", tags=["Интеграции"])

SYNC_ERRORS = error_responses(
    403,
    404,
    500,
    502,
    **{
        "403": ErrorCode.ACCESS_DENIED.value,
        "404": ErrorCode.NOT_FOUND.value,
        "500": ErrorCode.INTERNAL_ERROR.value,
        "502": ErrorCode.INTERNAL_ERROR.value,
    },
)


@router.get(
    "/sources",
    response_model=list[SourceDescription],
    summary="Состояние интеграций",
    description=(
        "Показывает, во что сейчас воткнут каждый источник и по какому соответствию "
        "полей разбираются его данные.\n\n"
        "**Контракт принят по допущению.** Заказчик не передал описание API (`OPEN-01`) "
        "и перечень согласованных полей (`OPEN-04`), поэтому источник без настроенного "
        "адреса работает в режиме `fixture` — на демонстрационных данных из репозитория. "
        "Когда контракт появится, меняется только соответствие полей "
        "в `app/integrations/contract.py`; остальной код приёма не трогается."
    ),
    responses=READ_ERRORS,
)
async def list_sources(scope: ScopeDep) -> list[SourceDescription]:
    return [SourceDescription.model_validate(item) for item in describe_sources()]


@router.post(
    "/{source}/sync",
    response_model=SyncResult,
    status_code=status.HTTP_200_OK,
    summary="Запустить синхронизацию",
    description=(
        "Забирает данные источника, приводит их к модели CRM и применяет.\n\n"
        "По умолчанию `dry_run = true`: запуск разбирает записи, считает, что изменится, "
        "и откатывает все изменения — новый источник можно направить на боевую базу "
        "и посмотреть результат, ничего не записав. Для реальной записи передайте "
        "`dry_run: false`.\n\n"
        "Запись идёт через тот же сервисный слой, что и импорт Excel, поэтому вуз из LMS "
        "и тот же вуз из файла не превращаются в два похожих. Ключ upsert — тройка "
        "«вуз + направление + продукт», так что повторный запуск не плодит дубли. "
        "Новые карточки автоматически встают на маршрут workflow по умолчанию.\n\n"
        "Пустое значение во внешней системе означает «нет данных» и не затирает "
        "заполненное поле в БД."
    ),
    responses=SYNC_ERRORS,
)
async def run_sync(
    source: IntegrationSource,
    data: SyncRequest,
    session: SessionDep,
    scope: ScopeDep,
    _: CurrentUser = Depends(require_manager),
) -> SyncResult:
    run = await IntegrationService(session, scope).sync(source, dry_run=data.dry_run)
    return SyncResult(
        run=IntegrationSyncRunRead.model_validate(run),
        stats=IntegrationSyncStats(**run.stats),
    )


@router.get(
    "/syncs",
    response_model=Page[IntegrationSyncRunRead],
    summary="История синхронизаций",
    description="Запуски с их статусами, статистикой и замечаниями по записям.",
    responses=READ_ERRORS,
)
async def list_runs(
    session: SessionDep,
    scope: ScopeDep,
    page: PaginationDep,
    source: IntegrationSource | None = Query(default=None, description="Фильтр по источнику"),
    sort: SortQuery = None,
) -> Page[IntegrationSyncRunRead]:
    items, total = await IntegrationService(session, scope).list_runs(
        source=source, page=page.page, size=page.size, sort=sort
    )
    return Page.build(
        [IntegrationSyncRunRead.model_validate(item) for item in items],
        total,
        page.page,
        page.size,
    )


@router.get(
    "/syncs/{run_id}",
    response_model=IntegrationSyncRunRead,
    summary="Результат одной синхронизации",
    description="Полная статистика и построчные замечания конкретного запуска.",
    responses=READ_ERRORS,
)
async def get_run(
    run_id: uuid.UUID, session: SessionDep, scope: ScopeDep
) -> IntegrationSyncRunRead:
    run = await IntegrationService(session, scope).get_run(run_id)
    return IntegrationSyncRunRead.model_validate(run)
