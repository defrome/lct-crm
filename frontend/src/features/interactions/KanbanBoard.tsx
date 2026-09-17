import { useMutation, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useMemo, useState } from 'react';

import { interactionsApi } from '@/api/endpoints';
import type { InteractionRead, StageRead, TransitionRead } from '@/api/types';
import { useToast } from '@/app/ToastProvider';
import { Avatar, Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/States';
import type { useStageLookup } from '@/features/workflows/useStageLookup';
import { formatDate, licenseState, shortName } from '@/lib/format';
import { InteractionSubject, LicenseDate } from './parts';
import { TransitionModal } from './TransitionModal';

const UNASSIGNED = '__unassigned';
const OTHER = '__other';

interface BoardColumn {
  key: string;
  stage: StageRead | null;
  /** Читается сразу, без перевода взгляда на легенду — код и название этапа. */
  code: string | null;
  title: string;
  cards: InteractionRead[];
  /** Колонка «Другой процесс» — только просмотр, карточки в ней не перетаскиваются. */
  readOnly?: boolean;
}

/**
 * Канбан-доска взаимодействий — второй вид того же списка, переключается из
 * FilterBar. Колонки — этапы процесса по умолчанию (то же, что «Где сейчас
 * работа» на дашборде), карточка внутри — `.lead-card` из дизайн-системы:
 * серая подложка, лёгкий подъём и поворот при наведении, cursor: grab.
 */
export function KanbanBoard({
  rows,
  stages,
  onOpen,
  onCreate,
  canEdit,
}: {
  rows: InteractionRead[];
  stages: ReturnType<typeof useStageLookup>;
  onOpen: (id: string) => void;
  onCreate?: () => void;
  canEdit: boolean;
}) {
  const toast = useToast();
  const client = useQueryClient();

  // Локальный «оптимистичный» перенос: карточка сразу рисуется в целевой
  // колонке, а не ждёт круг запрос-инвалидация-рефетч — иначе перетаскивание
  // выглядело бы так, будто ничего не произошло, и пользователь тянул бы её
  // снова.
  const [pending, setPending] = useState<Map<string, string | null>>(new Map());
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [validKeys, setValidKeys] = useState<Set<string> | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<{
    interactionId: string;
    stage: StageRead;
    transition: TransitionRead;
  } | null>(null);

  const primary = stages.primary;

  const orderedStages = useMemo(
    () => (primary ? [...primary.stages].sort((a, b) => a.order_index - b.order_index) : []),
    [primary],
  );

  // Куда можно перейти с каждого этапа — тот же граф, что рисует StageRail,
  // просто перегруппированный по стартовой точке ради быстрого поиска.
  const transitionsFrom = useMemo(() => {
    const map = new Map<string, TransitionRead[]>();
    for (const transition of primary?.transitions ?? []) {
      const list = map.get(transition.from_stage_id) ?? [];
      list.push(transition);
      map.set(transition.from_stage_id, list);
    }
    return map;
  }, [primary]);

  const initialStage = orderedStages.find((stage) => stage.is_initial) ?? orderedStages[0];

  const stageAt = (row: InteractionRead): string | null => {
    const override = pending.get(row.id);
    return override !== undefined ? override : (row.current_stage_id ?? null);
  };

  const columns = useMemo<BoardColumn[]>(() => {
    const primaryStageIds = new Set(orderedStages.map((stage) => stage.id));
    const unassigned: InteractionRead[] = [];
    const other: InteractionRead[] = [];
    const byStage = new Map<string, InteractionRead[]>();

    for (const row of rows) {
      const stageId = stageAt(row);
      if (stageId === null) {
        unassigned.push(row);
      } else if (primaryStageIds.has(stageId)) {
        const list = byStage.get(stageId) ?? [];
        list.push(row);
        byStage.set(stageId, list);
      } else {
        other.push(row);
      }
    }

    const result: BoardColumn[] = [
      { key: UNASSIGNED, stage: null, code: null, title: 'Не на маршруте', cards: unassigned },
      ...orderedStages.map((stage) => ({
        key: stage.id,
        stage,
        code: stage.code,
        title: stage.name,
        cards: byStage.get(stage.id) ?? [],
      })),
    ];
    // Показываем «Другой процесс» только если такие карточки реально есть —
    // иначе это пустая колонка ни о чём.
    if (other.length > 0) {
      result.push({
        key: OTHER,
        stage: null,
        code: null,
        title: 'Другой процесс',
        cards: other,
        readOnly: true,
      });
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, orderedStages, pending]);

  const clearPending = (id: string) => {
    setPending((current) => {
      if (!current.has(id)) return current;
      const next = new Map(current);
      next.delete(id);
      return next;
    });
  };

  const commit = useMutation({
    mutationFn: async (input: { id: string; to: StageRead; via: TransitionRead | 'start' }) => {
      if (input.via === 'start') {
        return interactionsApi.startRoute(input.id, { workflow_id: null });
      }
      return interactionsApi.transition(input.id, {
        to_stage_id: input.to.id,
        comment: null,
      });
    },
    onSuccess: async (_result, input) => {
      await client.invalidateQueries({ queryKey: ['interactions'] });
      toast.notify('Карточка переведена', input.to.name);
      clearPending(input.id);
    },
    onError: (error, input) => {
      clearPending(input.id);
      toast.fail(error, 'Не удалось перевести карточку');
    },
  });

  // Разрешённые цели для карточки: с текущего этапа — по графу переходов,
  // без этапа — только на старт базового процесса.
  const targetsFor = (row: InteractionRead): { stage: StageRead; via: TransitionRead | 'start' }[] => {
    const current = stageAt(row);
    if (current === null) {
      return initialStage ? [{ stage: initialStage, via: 'start' }] : [];
    }
    return (transitionsFrom.get(current) ?? [])
      .map((transition) => {
        const stage = orderedStages.find((candidate) => candidate.id === transition.to_stage_id);
        return stage ? { stage, via: transition } : null;
      })
      .filter((item) => item !== null);
  };

  // `draggable` на карточке уже отфильтровал те, для которых нет ни одного
  // перехода, так что здесь всегда есть хотя бы одна цель.
  const onDragStart = (event: React.DragEvent, row: InteractionRead) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', row.id);
    setDraggingId(row.id);
    setValidKeys(new Set(targetsFor(row).map((target) => target.stage.id)));
  };

  const onDragEnd = () => {
    setDraggingId(null);
    setValidKeys(null);
    setOverKey(null);
  };

  const onDrop = (event: React.DragEvent, column: BoardColumn) => {
    event.preventDefault();
    setOverKey(null);
    const id = event.dataTransfer.getData('text/plain');
    const row = rows.find((candidate) => candidate.id === id);
    if (!row || !column.stage) return;

    const target = targetsFor(row).find((item) => item.stage.id === column.stage!.id);
    if (!target) return; // Колонка не входила в подсвеченные — второй барьер на случай гонки состояний.

    if (target.via !== 'start' && target.via.requires_comment) {
      // Переходы с обязательным комментарием всё равно нельзя провести без
      // диалога — API отклонит запрос без текста, поэтому карточку сразу
      // спрашиваем, а не подвешиваем в «ничьей» колонке.
      setConfirmTarget({ interactionId: row.id, stage: target.stage, transition: target.via });
      return;
    }

    setPending((current) => new Map(current).set(row.id, column.stage!.id));
    commit.mutate({ id: row.id, to: target.stage, via: target.via });
  };

  if (!primary) {
    return (
      <EmptyState
        icon="route"
        title="Процесс не настроен"
        message="Опубликуйте версию workflow, чтобы вести карточки по этапам — пока канбан показать нечем."
      />
    );
  }

  return (
    <>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:gap-4 lg:px-0">
        {columns.map((column) => {
          const isValidTarget = Boolean(draggingId && !column.readOnly && validKeys?.has(column.key));
          const isDragActive = Boolean(draggingId);
          const isOver = overKey === column.key;
          return (
            <section
              key={column.key}
              onDragOver={(event) => {
                if (!isValidTarget) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                if (overKey !== column.key) setOverKey(column.key);
              }}
              onDragLeave={() => setOverKey((current) => (current === column.key ? null : current))}
              onDrop={(event) => onDrop(event, column)}
              className={clsx(
                'flex w-72 shrink-0 flex-col rounded-xl transition-colors duration-150',
                isOver ? 'bg-accent-container' : 'bg-surface-3',
              )}
            >
              <header className="flex items-center gap-2 px-3 pt-3 pb-2">
                {column.code ? (
                  <span className="tnum shrink-0 text-desc font-medium text-fg-muted">
                    {column.code}
                  </span>
                ) : (
                  <Icon
                    name={column.readOnly ? 'route' : 'clock'}
                    className="size-4 shrink-0 text-fg-muted"
                  />
                )}
                <h3 className="min-w-0 flex-1 truncate text-body-s font-medium text-fg" title={column.title}>
                  {column.title}
                </h3>
                <Badge tone={column.cards.length > 0 ? 's01' : 'neutral'}>{column.cards.length}</Badge>
              </header>

              <div className="flex min-h-24 flex-1 flex-col gap-2 px-3 pb-3">
                {column.cards.map((row) => (
                  <KanbanCard
                    key={row.id}
                    row={row}
                    draggable={!column.readOnly && targetsFor(row).length > 0}
                    isMoving={pending.has(row.id)}
                    onDragStart={(event) => onDragStart(event, row)}
                    onDragEnd={onDragEnd}
                    onOpen={() => onOpen(row.id)}
                  />
                ))}

                {column.cards.length === 0 &&
                  (isValidTarget ? (
                    <div className="grid flex-1 min-h-16 place-items-center rounded-l border border-dashed border-line-default text-center text-desc text-fg-muted">
                      Отпустите здесь
                    </div>
                  ) : (
                    !isDragActive && (
                      <p className="py-4 text-center text-desc text-fg-muted">Нет карточек</p>
                    )
                  ))}

                {column.key === UNASSIGNED && canEdit && onCreate && column.cards.length === 0 && !isDragActive && (
                  <button
                    type="button"
                    onClick={onCreate}
                    className="flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-m border-0 bg-transparent text-body-s text-accent transition-colors hover:bg-accent-container"
                  >
                    <Icon name="plus" className="size-4" />
                    Новая карточка
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <TransitionModal
        interactionId={confirmTarget?.interactionId ?? ''}
        target={confirmTarget ? { stage: confirmTarget.stage, transition: confirmTarget.transition } : null}
        onClose={() => setConfirmTarget(null)}
      />
    </>
  );
}

function KanbanCard({
  row,
  draggable,
  isMoving,
  onDragStart,
  onDragEnd,
  onOpen,
}: {
  row: InteractionRead;
  draggable: boolean;
  isMoving: boolean;
  onDragStart: (event: React.DragEvent) => void;
  onDragEnd: () => void;
  onOpen: () => void;
}) {
  const urgent = licenseState(row.license_expires_at) !== 'active';

  return (
    <article
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      className={clsx(
        'group flex flex-col gap-3 rounded-xl bg-surface-1 p-3 transition-[transform,box-shadow,background-color] duration-300 ease-productive',
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        isMoving ? 'opacity-50' : 'hover:-translate-y-0.5 hover:rotate-[-.6deg] hover:shadow-bottom-m',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        {urgent ? (
          <LicenseDate value={row.license_expires_at} showBadge />
        ) : (
          <span className="tnum text-desc text-fg-muted">{row.contract_number ?? '—'}</span>
        )}
        {draggable && (
          <Icon
            name="more"
            className="size-4 shrink-0 text-fg-muted opacity-0 transition-opacity group-hover:opacity-100"
          />
        )}
      </div>

      <InteractionSubject row={row} />

      <div className="flex items-center justify-between gap-2">
        {row.responsible_user ? (
          <span className="flex min-w-0 items-center gap-2">
            <Avatar name={row.responsible_user.full_name} size={36} />
            <span className="truncate text-desc text-fg-muted">
              {shortName(row.responsible_user.full_name)}
            </span>
          </span>
        ) : (
          <span className="text-desc text-fg-muted">Не назначен</span>
        )}
        {row.license_signed_at && !urgent && (
          <span className="tnum shrink-0 text-desc text-fg-muted">
            {formatDate(row.updated_at)}
          </span>
        )}
      </div>
    </article>
  );
}

