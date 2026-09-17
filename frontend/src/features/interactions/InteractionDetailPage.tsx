import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { interactionsApi } from '@/api/endpoints';
import { useAttachments, useInteraction, useRoute, useWorkflows } from '@/api/queries';
import type { RouteView, StageRead, TransitionRead } from '@/api/types';
import { useAuth } from '@/app/AuthProvider';
import { useToast } from '@/app/ToastProvider';
import { Page } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Select, SegmentedControl } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { ConfirmModal, Modal } from '@/components/ui/Modal';
import { Blank, CardHeader, DataRow, ErrorState, PageHeader, Skeleton } from '@/components/ui/States';
import { StageRail, type StageRailItem } from '@/features/workflows/StageRail';
import { formatDate, formatDateTime, licenseState, shortName } from '@/lib/format';
import { AttachmentsPanel } from './AttachmentsPanel';
import { InteractionFormModal } from './InteractionFormModal';
import { LicenseDate } from './parts';
import { RouteKanban } from './RouteKanban';
import { TransitionModal } from './TransitionModal';

type RouteViewMode = 'line' | 'kanban';

const ROUTE_VIEW_OPTIONS: { value: RouteViewMode; label: string; icon: 'route' | 'kanban' }[] = [
  { value: 'line', label: 'Линия', icon: 'route' },
  { value: 'kanban', label: 'Канбан', icon: 'kanban' },
];

// Отдельно от прочих настроек экрана — тот же приём, что и выбор вида списка
// взаимодействий: предпочтение конкретного человека, а не часть карточки.
const ROUTE_VIEW_STORAGE_KEY = 'crm:route:view';

function readStoredRouteView(): RouteViewMode {
  try {
    return localStorage.getItem(ROUTE_VIEW_STORAGE_KEY) === 'kanban' ? 'kanban' : 'line';
  } catch {
    return 'line';
  }
}

export function InteractionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const client = useQueryClient();
  const { can } = useAuth();

  const card = useInteraction(id);
  const route = useRoute(id);
  const files = useAttachments(id);

  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moveTo, setMoveTo] = useState<{ stage: StageRead; transition: TransitionRead } | null>(null);
  const [starting, setStarting] = useState(false);
  const [uploadStage, setUploadStage] = useState<StageRead | null>(null);
  const [routeView, setRouteView] = useState<RouteViewMode>(readStoredRouteView);

  const changeRouteView = (next: RouteViewMode) => {
    setRouteView(next);
    try {
      localStorage.setItem(ROUTE_VIEW_STORAGE_KEY, next);
    } catch {
      // Приватный режим браузера может запрещать запись — переключатель
      // просто не переживёт перезагрузку.
    }
  };

  const remove = useMutation({
    mutationFn: () => interactionsApi.remove(id!),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['interactions'] });
      toast.notify('Карточка удалена');
      navigate('/interactions');
    },
    onError: (error) => toast.fail(error, 'Не удалось удалить карточку'),
  });

  const attachmentsByStage = useMemo(() => {
    const counts = new Map<string, number>();
    for (const file of files.data?.items ?? []) {
      counts.set(file.stage_id, (counts.get(file.stage_id) ?? 0) + 1);
    }
    return counts;
  }, [files.data]);

  const sortedStages = useMemo(
    () => [...(route.data?.stages ?? [])].sort((a, b) => a.order_index - b.order_index),
    [route.data?.stages],
  );

  const availableByStage = useMemo(
    () =>
      new Map(
        (route.data?.available_transitions ?? []).map((transition) => [
          transition.to_stage_id,
          transition,
        ]),
      ),
    [route.data?.available_transitions],
  );

  const railItems = useMemo<StageRailItem[]>(() => {
    const view = route.data;
    if (!view?.stages?.length) return [];

    const stages = sortedStages;
    const currentIndex = stages.findIndex((stage) => stage.id === view.current_stage_id);
    const available = availableByStage;

    // The last time the card arrived at each stage, and what was said about it.
    const visits = new Map<string, { at: string; comment: string | null }>();
    for (const entry of view.history ?? []) {
      visits.set(entry.to_stage_id, { at: entry.created_at, comment: entry.comment });
    }

    return stages.map((stage, index) => {
      const shortcuts = (view.transitions ?? [])
        .filter((transition) => transition.from_stage_id === stage.id)
        .map((transition) => ({
          transition,
          to: stages.find((candidate) => candidate.id === transition.to_stage_id),
        }))
        // Only the jumps worth naming: the next step and the step back are the
        // route itself and would just repeat what the line already shows.
        .filter(({ to }) => to && Math.abs(stages.indexOf(to) - index) > 1)
        .map(({ transition, to }) => ({ to: to!, name: transition.name }));

      return {
        stage,
        state:
          stage.id === view.current_stage_id
            ? 'current'
            : currentIndex >= 0 && index < currentIndex
              ? 'done'
              : visits.has(stage.id)
                ? 'done'
                : 'upcoming',
        visitedAt: visits.get(stage.id)?.at,
        comment: stage.id === view.current_stage_id ? visits.get(stage.id)?.comment : undefined,
        attachments: attachmentsByStage.get(stage.id),
        available: available.get(stage.id),
        shortcuts: shortcuts.length > 0 ? shortcuts : undefined,
      };
    });
  }, [route.data, sortedStages, availableByStage, attachmentsByStage]);

  if (card.error) return <Page><ErrorState error={card.error} onRetry={() => void card.refetch()} /></Page>;

  const record = card.data;
  const onRoute = Boolean(route.data?.current_stage_id);
  const currentItem = railItems.find((item) => item.state === 'current');

  return (
    <Page>

      <PageHeader
        back={{ to: '/interactions', label: 'Все взаимодействия' }}
        eyebrow="Карточка взаимодействия"
        title={
          record ? (
            <Link
              to={`/universities/${record.university_id}`}
              className="transition-colors hover:text-accent"
            >
              {record.university?.name ?? 'Вуз'}
            </Link>
          ) : (
            <Skeleton className="h-7 w-80" />
          )
        }
        meta={
          record &&
          ([record.it_direction?.name, record.it_product?.name].filter(Boolean).join(' · ') ||
            'Направление и продукт не заданы')
        }
        actions={
          record &&
          can('manager') && (
            <>
              <Button icon="edit" onClick={() => setEditing(true)}>
                Изменить
              </Button>
              {can('admin') && (
                <IconButton icon="trash" label="Удалить карточку" onClick={() => setDeleting(true)} />
              )}
            </>
          )
        }
      />

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          <section className="card card-pad">
            <CardHeader
              className="mb-6"
              title="Путь работы с вузом"
              sub={route.data?.version && `Маршрут, версия ${route.data.version.version}`}
              actions={
                onRoute &&
                route.data?.stages && (
                  <>
                    <Badge tone="s01">
                      этап {railItems.findIndex((item) => item.state === 'current') + 1} из{' '}
                      {railItems.length}
                    </Badge>
                    <SegmentedControl
                      value={routeView}
                      onChange={changeRouteView}
                      options={ROUTE_VIEW_OPTIONS}
                    />
                  </>
                )
              }
            />

            {route.isPending ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 5 }, (_, index) => (
                  <Skeleton key={index} className="h-6 w-full" />
                ))}
              </div>
            ) : railItems.length === 0 ? (
              <NotOnRoute onStart={() => setStarting(true)} canStart={can('manager')} />
            ) : routeView === 'kanban' ? (
              <RouteKanban
                stages={sortedStages}
                currentStageId={route.data?.current_stage_id ?? null}
                availableByStage={availableByStage}
                visitedAt={currentItem?.visitedAt}
                comment={currentItem?.comment}
                attachments={currentItem?.attachments}
                movable={can('user')}
                onMove={
                  can('user') ? (target) => setMoveTo(target) : undefined
                }
                onAttach={currentItem ? () => setUploadStage(currentItem.stage) : undefined}
              />
            ) : (
              <StageRail
                items={railItems}
                onMove={
                  can('user')
                    ? (item) =>
                        item.available &&
                        setMoveTo({ stage: item.stage, transition: item.available })
                    : undefined
                }
                onAttach={setUploadStage}
              />
            )}
          </section>

          <HistoryPanel route={route.data} />
        </div>

        <div className="flex flex-col gap-4">
          <section className="card card-pad">
            <h2 className="card-title mb-5">Договор и лицензия</h2>
            {record ? (
              <dl className="flex flex-col">
                <DataRow label="Номер договора" mono>
                  {record.contract_number ?? <Blank />}
                </DataRow>
                <DataRow label="Подписание" mono>
                  {record.license_signed_at ? formatDate(record.license_signed_at) : <Blank />}
                </DataRow>
                <DataRow label="Срок действия" mono>
                  {record.license_years ? `${record.license_years} г.` : <Blank />}
                </DataRow>
                <DataRow label="Действует до">
                  <LicenseDate
                    value={record.license_expires_at}
                    showBadge={licenseState(record.license_expires_at) !== 'active'}
                  />
                </DataRow>
                <DataRow label="Ответственный">
                  {record.responsible_user ? (
                    shortName(record.responsible_user.full_name)
                  ) : (
                    <Blank>не назначен</Blank>
                  )}
                </DataRow>
                <DataRow label="Статус по передаче">
                  {record.transfer_status ?? <Blank />}
                </DataRow>
                <DataRow label="Обновлена" mono>
                  {formatDateTime(record.updated_at)}
                </DataRow>
              </dl>
            ) : (
              <div className="flex flex-col gap-3 py-2">
                {Array.from({ length: 6 }, (_, index) => (
                  <Skeleton key={index} className="h-4 w-full" />
                ))}
              </div>
            )}

            {record?.comment && (
              <div className="mt-4 rounded-m bg-surface-3 p-3">
                <p className="cap mb-1">Комментарий</p>
                <p className="text-body-s text-fg-soft">{record.comment}</p>
              </div>
            )}
          </section>

          <AttachmentsPanel
            interactionId={id!}
            attachments={files.data?.items ?? []}
            stages={route.data?.stages ?? []}
            currentStageId={route.data?.current_stage_id ?? null}
            loading={files.isPending}
            uploadStage={uploadStage}
            onUploadStageChange={setUploadStage}
          />
        </div>
      </div>

      {record && (
        <InteractionFormModal open={editing} onClose={() => setEditing(false)} record={record} />
      )}

      <ConfirmModal
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        danger
        title="Удалить карточку?"
        confirmLabel="Удалить"
        message="Карточка будет помечена удалённой. История и вложения сохранятся в журнале аудита."
      />

      <TransitionModal
        interactionId={id!}
        target={moveTo}
        onClose={() => setMoveTo(null)}
      />

      <StartRouteModal
        interactionId={id!}
        open={starting}
        onClose={() => setStarting(false)}
      />
    </Page>
  );
}

function NotOnRoute({ onStart, canStart }: { onStart: () => void; canStart: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-surface-3 text-fg-muted">
        <Icon name="route" className="size-5" />
      </span>
      <div className="max-w-sm">
        <p className="font-medium text-fg">Карточка ещё не на маршруте</p>
        <p className="mt-1 text-body-s text-fg-muted">
          Поставьте её на процесс — и путь работы с вузом будет виден по шагам, с комментариями и
          файлами на каждом.
        </p>
      </div>
      {canStart && (
        <Button variant="primary" icon="play" onClick={onStart}>
          Поставить на маршрут
        </Button>
      )}
    </div>
  );
}

function StartRouteModal({
  interactionId,
  open,
  onClose,
}: {
  interactionId: string;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const client = useQueryClient();
  const workflows = useWorkflows({ size: 100 });
  const [workflowId, setWorkflowId] = useState('');

  const start = useMutation({
    mutationFn: () =>
      interactionsApi.startRoute(interactionId, { workflow_id: workflowId || null }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['interactions'] });
      toast.notify('Карточка поставлена на маршрут');
      onClose();
    },
    onError: (error) => toast.fail(error, 'Не удалось поставить на маршрут'),
  });

  const options = (workflows.data?.items ?? []).map((workflow) => ({
    value: workflow.id,
    label: workflow.is_default ? `${workflow.name} — по умолчанию` : workflow.name,
  }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Поставить карточку на маршрут"
      description="Карточка встанет на первый этап выбранного процесса"
      footer={
        <>
          <Button onClick={onClose} disabled={start.isPending}>
            Отмена
          </Button>
          <Button variant="primary" loading={start.isPending} onClick={() => start.mutate()}>
            Поставить
          </Button>
        </>
      }
    >
      <Select
        label="Процесс"
        options={options}
        placeholder="Процесс по умолчанию"
        value={workflowId}
        onChange={(event) => setWorkflowId(event.target.value)}
        hint="Оставьте пустым — возьмётся базовый процесс из 14 шагов"
      />
    </Modal>
  );
}

/** How much history fits before the card stops being readable at a glance. */
const HISTORY_PREVIEW = 6;

function HistoryPanel({ route }: { route?: RouteView }) {
  const [expanded, setExpanded] = useState(false);
  const all = [...(route?.history ?? [])].reverse();
  const entries = expanded ? all : all.slice(0, HISTORY_PREVIEW);
  const stageName = (stageId: string | null) => {
    if (!stageId) return null;
    const stage = route?.stages?.find((candidate) => candidate.id === stageId);
    return stage ? (stage.code ?? stage.name) : null;
  };

  if (all.length === 0) return null;

  return (
    <section className="card">
      <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 sm:px-7 sm:pt-7">
        <h2 className="card-title">История перемещений</h2>
        <Badge>{all.length}</Badge>
      </header>
      <ol className="flex flex-col px-3 pb-3 sm:px-5 sm:pb-5">
        {entries.map((entry) => (
          <li key={entry.id} className="flex gap-3 rounded-l px-2 py-2.5">
            <span className="mt-1 shrink-0 text-fg-muted">
              <Icon name="arrowRight" className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-body-s text-fg">
                {entry.from_stage_id ? (
                  <>
                    <span className="tnum text-body-s text-fg-muted">
                      {stageName(entry.from_stage_id)}
                    </span>{' '}
                    →{' '}
                  </>
                ) : (
                  'Поставлена на маршрут: '
                )}
                <span className="tnum text-body-s font-medium text-s01 dark:text-s01-200">
                  {stageName(entry.to_stage_id)}
                </span>
              </p>
              {entry.comment && (
                <p className="mt-1 text-body-s text-fg-soft">{entry.comment}</p>
              )}
              <p className="tnum mt-0.5 text-desc text-fg-muted">
                {formatDateTime(entry.created_at)}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {all.length > HISTORY_PREVIEW && (
        <button
          type="button"
          onClick={() => setExpanded((previous) => !previous)}
          className="mx-5 mb-5 h-9 w-[calc(100%-2.5rem)] cursor-pointer rounded-m border-0 bg-neutral-container text-body-s font-medium text-fg transition-colors hover:bg-neutral-container-hover sm:mx-7 sm:mb-7 sm:w-[calc(100%-3.5rem)]"
        >
          {expanded ? 'Свернуть' : `Показать все ${all.length}`}
        </button>
      )}
    </section>
  );
}
