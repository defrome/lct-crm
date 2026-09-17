import clsx from 'clsx';
import { useState } from 'react';

import type { StageRead, TransitionRead } from '@/api/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { formatDate } from '@/lib/format';

/**
 * Второй вид «Пути работы с вузом» — та же линия StageRail, но колонками:
 * карточка одна, стоит в колонке своего этапа, и её можно перетащить (или
 * нажать целевую колонку) в любую разрешённую с текущего этапа сторону.
 */
export function RouteKanban({
  stages,
  currentStageId,
  availableByStage,
  visitedAt,
  comment,
  attachments,
  movable,
  onMove,
  onAttach,
}: {
  stages: StageRead[];
  currentStageId: string | null;
  /** Переходы, доступные с текущего этапа, — по целевому этапу. */
  availableByStage: Map<string, TransitionRead>;
  visitedAt?: string | null;
  comment?: string | null;
  attachments?: number;
  movable: boolean;
  onMove?: (target: { stage: StageRead; transition: TransitionRead }) => void;
  onAttach?: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [overId, setOverId] = useState<string | null>(null);
  const currentIndex = stages.findIndex((stage) => stage.id === currentStageId);
  const canDrag = movable && availableByStage.size > 0;

  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
      {stages.map((stage, index) => {
        const isCurrent = stage.id === currentStageId;
        const isDone = currentIndex >= 0 && index < currentIndex;
        const target = availableByStage.get(stage.id);
        const isValidTarget = Boolean(dragging && target);
        const isOver = overId === stage.id;

        return (
          <section
            key={stage.id}
            onDragOver={(event) => {
              if (!isValidTarget) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              if (overId !== stage.id) setOverId(stage.id);
            }}
            onDragLeave={() => setOverId((current) => (current === stage.id ? null : current))}
            onDrop={(event) => {
              event.preventDefault();
              setOverId(null);
              if (target) onMove?.({ stage, transition: target });
            }}
            className={clsx(
              'flex w-44 shrink-0 flex-col rounded-xl transition-colors duration-150',
              isOver ? 'bg-accent-container' : 'bg-surface-3',
            )}
          >
            <header className="flex items-center gap-2 px-3 pt-3 pb-2">
              {stage.code && (
                <span className="tnum shrink-0 text-desc font-medium text-fg-muted">
                  {stage.code}
                </span>
              )}
              <h3
                className="min-w-0 flex-1 truncate text-body-s font-medium text-fg"
                title={stage.name}
              >
                {stage.name}
              </h3>
              {isDone && <Icon name="check" className="size-4 shrink-0 text-s01" />}
            </header>

            <div className="flex min-h-20 flex-1 flex-col gap-2 px-3 pb-3">
              {isCurrent && (
                <article
                  draggable={canDrag}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', stage.id);
                    setDragging(true);
                  }}
                  onDragEnd={() => {
                    setDragging(false);
                    setOverId(null);
                  }}
                  className={clsx(
                    'flex flex-col gap-2 rounded-l bg-surface-1 p-3 shadow-bottom-s transition-transform duration-150',
                    canDrag && 'cursor-grab hover:-translate-y-0.5 hover:shadow-bottom-m active:cursor-grabbing',
                  )}
                >
                  <Badge tone="s01" className="self-start">
                    сейчас
                  </Badge>
                  {visitedAt && (
                    <span className="tnum inline-flex items-center gap-1.5 text-desc text-fg-muted">
                      <Icon name="clock" className="size-3.5" />
                      на этапе с {formatDate(visitedAt)}
                    </span>
                  )}
                  {comment && <p className="text-body-s text-fg-soft">{comment}</p>}
                  {onAttach && (
                    <button
                      type="button"
                      onClick={onAttach}
                      className="inline-flex items-center gap-1.5 self-start border-0 bg-transparent p-0 text-desc text-accent hover:underline"
                    >
                      <Icon name="paperclip" className="size-3.5" />
                      {attachments ? `Файлы (${attachments})` : 'Приложить файл'}
                    </button>
                  )}
                </article>
              )}

              {!isCurrent && isValidTarget && (
                <div className="grid min-h-16 flex-1 place-items-center rounded-l border border-dashed border-line-default text-center text-desc text-fg-muted">
                  Отпустите здесь
                </div>
              )}

              {!isCurrent && target && !dragging && onMove && (
                <Button
                  size="s"
                  variant="ghost"
                  scheme="accent"
                  iconAfter="arrowRight"
                  onClick={() => onMove({ stage, transition: target })}
                  className="justify-center"
                >
                  {target.name ?? 'Перевести сюда'}
                </Button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
