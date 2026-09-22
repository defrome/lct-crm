import clsx from 'clsx';
import { useState, type ReactNode } from 'react';

import { Button } from './Button';
import { CONTROL } from './Field';
import { Icon } from './Icon';
import { Modal } from './Modal';

/**
 * Строка фильтров над списком.
 *
 * На десктопе все фильтры видны сразу — понимать, чем можно отобрать список,
 * так же важно, как отбирать. Ниже `lg` они уходят в окно: снаружи остаются
 * поиск и кнопка со счётчиком включённых условий.
 */
export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Поиск',
  activeCount,
  onReset,
  children,
  trailing,
}: {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  activeCount: number;
  onReset: () => void;
  children: ReactNode;
  /** Справа: переключатели вида, выгрузки. */
  trailing?: ReactNode;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const hasFilters = Boolean(children);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {onSearchChange && (
        <div className="relative w-full shrink-0 sm:w-80">
          <Icon
            name="search"
            className="pointer-events-none absolute top-3 left-3 size-6 text-fg-muted"
          />
          <input
            value={search ?? ''}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            type="search"
            aria-label={searchPlaceholder}
            className={clsx(CONTROL, 'h-12 pl-11')}
          />
        </div>
      )}

      {hasFilters && (
          <>
            <Button icon="filter" onClick={() => setSheetOpen(true)}>
              Фильтры
              {activeCount > 0 && (
                <span className="tnum ml-1.5 inline-grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-desc font-medium text-white">
                  {activeCount}
                </span>
              )}
            </Button>
            <Modal
              open={sheetOpen}
              onClose={() => setSheetOpen(false)}
              title="Фильтры"
              description="Отбор применяется сразу"
              footer={
                <>
                  <Button variant="outline" onClick={onReset} disabled={activeCount === 0}>
                    Сбросить
                  </Button>
                  <Button variant="primary" onClick={() => setSheetOpen(false)}>
                    Показать
                  </Button>
                </>
              }
            >
              <div className="flex flex-col gap-3">{children}</div>
            </Modal>
          </>
        )}

      {activeCount > 0 && (
        <Button variant="ghost" scheme="accent" icon="close" onClick={onReset}>
          Сбросить
        </Button>
      )}

      {trailing && <div className="ml-auto flex items-center gap-2">{trailing}</div>}
    </div>
  );
}

/** Фильтр в строке — уже поля формы. */
export function FilterSlot({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={clsx('w-full lg:w-56', className)}>{children}</div>;
}

/** Пара дат «с — по» для отбора за период. */
export function PeriodFilter({
  from,
  to,
  onChange,
  label = 'Период',
  stacked,
}: {
  from?: string;
  to?: string;
  onChange: (next: { from?: string; to?: string }) => void;
  label?: string;
  /** Для узких боковых панелей: даты друг под другом на всю ширину. */
  stacked?: boolean;
}) {
  if (stacked) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={from ?? ''}
          aria-label={`${label}: с`}
          onChange={(event) => onChange({ from: event.target.value || undefined, to })}
          className={clsx(CONTROL, 'tnum h-12 min-w-0 px-3 text-body-m lg:text-body-s')}
        />
        <input
          type="date"
          value={to ?? ''}
          aria-label={`${label}: по`}
          onChange={(event) => onChange({ from, to: event.target.value || undefined })}
          className={clsx(CONTROL, 'tnum h-12 min-w-0 px-3 text-body-m lg:text-body-s')}
        />
      </div>
    );
  }

  return (
    <div className="flex w-full items-center gap-2 lg:w-auto">
      <Icon name="calendar" className="size-6 shrink-0 text-fg-muted" />
      <input
        type="date"
        value={from ?? ''}
        aria-label={`${label}: с`}
        onChange={(event) => onChange({ from: event.target.value || undefined, to })}
        className={clsx(CONTROL, 'tnum h-12 min-w-0 flex-1 px-3 text-body-m lg:w-40 lg:flex-none lg:text-body-s')}
      />
      <span className="text-fg-muted">–</span>
      <input
        type="date"
        value={to ?? ''}
        aria-label={`${label}: по`}
        onChange={(event) => onChange({ from, to: event.target.value || undefined })}
        className={clsx(CONTROL, 'tnum h-12 min-w-0 flex-1 px-3 text-body-m lg:w-40 lg:flex-none lg:text-body-s')}
      />
    </div>
  );
}
