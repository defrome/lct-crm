import clsx from 'clsx';

import type { StageRead, TransitionRead } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { formatDate } from '@/lib/format';

export type StageState = 'done' | 'current' | 'upcoming';

export interface StageRailItem {
  stage: StageRead;
  state: StageState;
  /** When the card arrived at this stage, if it ever did. */
  visitedAt?: string | null;
  comment?: string | null;
  attachments?: number;
  /** The transition that would move the card here from where it stands now. */
  available?: TransitionRead;
  /** Stages reachable from here by a transition that isn't the next step. */
  shortcuts?: { to: StageRead; name: string | null }[];
}

/**
 * The route a card travels, drawn as a line with stations.
 *
 * Fourteen steps with long Russian names do not fit a horizontal stepper, and
 * stacking them vertically is also how a transit line is read inside a
 * carriage: the line runs down the left, every stop is named, and the marker
 * shows where you are. Non-sequential transitions — the ТЗ allows skipping the
 * document correction step, and any step can be walked back — are drawn as
 * connectors off a station rather than as a second line, because they are
 * exceptions to the route, not a route of their own.
 */
export function StageRail({
  items,
  onMove,
  onAttach,
  busyStageId,
  className,
}: {
  items: StageRailItem[];
  /** Omitted when the viewer may not move the card. */
  onMove?: (item: StageRailItem) => void;
  onAttach?: (stage: StageRead) => void;
  busyStageId?: string | null;
  className?: string;
}) {
  return (
    <ol className={clsx('flex flex-col', className)}>
      {items.map((item, index) => (
        <Station
          key={item.stage.id}
          item={item}
          first={index === 0}
          last={index === items.length - 1}
          onMove={onMove}
          onAttach={onAttach}
          busy={busyStageId === item.stage.id}
        />
      ))}
    </ol>
  );
}

function Station({
  item,
  first,
  last,
  onMove,
  onAttach,
  busy,
}: {
  item: StageRailItem;
  first: boolean;
  last: boolean;
  onMove?: (item: StageRailItem) => void;
  onAttach?: (stage: StageRead) => void;
  busy?: boolean;
}) {
  const { stage, state, available } = item;
  const movable = Boolean(available && onMove);

  return (
    <li
      className={clsx(
        'group relative grid grid-cols-[24px_1fr] gap-x-4',
        state === 'upcoming' && !movable && 'opacity-60',
      )}
    >
      {/* Линия маршрута: пройденный участок — status-01, впереди — border-soft. */}
      <div className="relative flex justify-center">
        {!first && (
          <span
            aria-hidden="true"
            className={clsx(
              'absolute top-0 h-3 w-0.5 rounded-full',
              state === 'done' || state === 'current' ? 'bg-s01' : 'bg-line-soft',
            )}
          />
        )}
        {!last && (
          <span
            aria-hidden="true"
            className={clsx(
              'absolute top-3 bottom-0 w-0.5 rounded-full',
              state === 'done' ? 'bg-s01' : 'bg-line-soft',
            )}
          />
        )}
        <Marker state={state} terminal={stage.is_final_success} />
      </div>

      <div className={clsx('min-w-0', last ? 'pb-0' : 'pb-5')}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {stage.code && (
            <span
              className={clsx(
                'tnum text-body-s',
                state === 'current' ? 'font-medium text-s01 dark:text-s01-200' : 'text-fg-muted',
              )}
            >
              {stage.code}
            </span>
          )}
          <span
            className={clsx(
              'text-body-m',
              state === 'current' ? 'font-medium text-fg' : 'text-fg-soft',
            )}
          >
            {stage.name}
          </span>
          {state === 'current' && <Badge tone="s01">сейчас</Badge>}
        </div>

        {(item.visitedAt || item.attachments) && (
          <div className="tnum mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-body-s text-fg-muted">
            {item.visitedAt && (
              <span className="inline-flex items-center gap-1.5">
                <Icon name={state === 'current' ? 'clock' : 'check'} className="size-4" />
                {state === 'current'
                  ? `на этапе с ${formatDate(item.visitedAt)}`
                  : formatDate(item.visitedAt)}
              </span>
            )}
            {Boolean(item.attachments) && (
              <span className="inline-flex items-center gap-1.5">
                <Icon name="paperclip" className="size-4" />
                {item.attachments}
              </span>
            )}
          </div>
        )}

        {item.comment && (
          <p className="mt-2 rounded-l bg-surface-3 px-3 py-2 text-body-s text-fg-soft">
            {item.comment}
          </p>
        )}

        {item.shortcuts?.map((shortcut) => (
          <p
            key={shortcut.to.id}
            className="mt-1.5 flex items-center gap-1.5 text-body-s text-fg-muted"
          >
            <Icon name="go" className="size-4 shrink-0" />
            {shortcut.name ?? 'Переход'} → {shortcut.to.code ?? shortcut.to.name}
          </p>
        ))}

        {(movable || (onAttach && state === 'current')) && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {movable && (
              <Button
                size="m"
                variant="secondary"
                scheme="accent"
                iconAfter="arrowRight"
                disabled={busy}
                onClick={() => onMove?.(item)}
              >
                {available?.name ?? 'Перевести сюда'}
              </Button>
            )}
            {onAttach && state === 'current' && (
              <Button size="m" variant="ghost" icon="paperclip" onClick={() => onAttach(stage)}>
                Приложить файл
              </Button>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function Marker({ state, terminal }: { state: StageState; terminal: boolean }) {
  if (state === 'current') {
    return (
      <span className="relative z-10 mt-1 grid size-4 place-items-center rounded-full bg-s01 shadow-[0_0_0_4px_var(--atmr-status-01-container-default)]">
        <span className="size-1.5 rounded-full bg-white" />
      </span>
    );
  }
  if (state === 'done') {
    return (
      <span className="relative z-10 mt-1 grid size-4 place-items-center rounded-full bg-s01 text-white">
        <Icon name={terminal ? 'flag' : 'check'} className="size-2.5" strokeWidth={2.6} />
      </span>
    );
  }
  return (
    <span className="relative z-10 mt-1.5 size-3 rounded-full bg-card shadow-[inset_0_0_0_2px_var(--atmr-border-soft)]" />
  );
}
