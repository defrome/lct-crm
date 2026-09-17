import clsx from 'clsx';
import type { ReactNode } from 'react';

import { IconButton } from './Button';
import { Icon } from './Icon';
import { EmptyState, ErrorState, TableSkeleton } from './States';

/*
 * Таблица — как «Выигранные сделки» в системе: без линий, заголовки
 * description-l цвета fg-muted, строки body-s; при наведении строка ложится на
 * surface3 со скруглением l. Ниже `md` строки превращаются в карточки канбана.
 */
export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Поле для параметра `sort` API; без него колонка не сортируется. */
  sortKey?: string;
  width?: string;
  align?: 'left' | 'right';
  /** Скрывать колонку на узких экранах — форма таблицы сохраняется. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
}

const HIDE_CLASS = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  onRowClick?: (row: T) => void;
  /** Текущая сортировка API, например `-created_at`. */
  sort?: string;
  onSortChange?: (sort: string | undefined) => void;
  empty?: ReactNode;
  /** Ниже `md` таблица заменяется этими карточками. */
  renderCard?: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  error,
  onRetry,
  onRowClick,
  sort,
  onSortChange,
  empty,
  renderCard,
  className,
}: DataTableProps<T>) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (loading) return <TableSkeleton columns={Math.min(columns.length, 6)} />;
  if (rows.length === 0) {
    return <>{empty ?? <EmptyState title="Пока ничего нет" message="Записи появятся здесь." />}</>;
  }

  // Клик по колонке: по возрастанию → по убыванию → без сортировки.
  const toggleSort = (sortKey: string) => {
    if (!onSortChange) return;
    if (sort === sortKey) onSortChange(`-${sortKey}`);
    else if (sort === `-${sortKey}`) onSortChange(undefined);
    else onSortChange(sortKey);
  };

  return (
    <div className={className}>
      {renderCard && (
        <div className="flex flex-col gap-2 md:hidden">
          {rows.map((row, index) => (
            <div
              key={rowKey(row)}
              role={onRowClick ? 'button' : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              className={clsx(
                'animate-rise flex flex-col gap-3 rounded-xl bg-surface-3 p-4',
                'transition-[transform,box-shadow,background-color] duration-300 ease-productive',
                onRowClick &&
                  'cursor-pointer hover:-translate-y-0.5 hover:bg-card hover:shadow-bottom-m',
              )}
              style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {renderCard(row)}
            </div>
          ))}
        </div>
      )}

      <div className={clsx('-mx-2 overflow-x-auto', renderCard && 'hidden md:block')}>
        <table className="tnum w-full border-separate border-spacing-0 text-body-s">
          <thead>
            <tr>
              {columns.map((column) => {
                const active =
                  column.sortKey && (sort === column.sortKey || sort === `-${column.sortKey}`);
                const descending = sort === `-${column.sortKey}`;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    style={column.width ? { width: column.width } : undefined}
                    className={clsx(
                      'label px-2 pb-2.5 text-left font-normal whitespace-nowrap',
                      column.align === 'right' && 'text-right',
                      column.hideBelow && HIDE_CLASS[column.hideBelow],
                    )}
                  >
                    {column.sortKey && onSortChange ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.sortKey!)}
                        className={clsx(
                          'group/sort inline-flex cursor-pointer items-center gap-1 rounded-xs border-0 bg-transparent p-0 text-desc transition-colors duration-150',
                          active ? 'text-fg' : 'text-fg-muted hover:text-fg',
                          column.align === 'right' && 'flex-row-reverse',
                        )}
                      >
                        {column.header}
                        <Icon
                          name={active && descending ? 'sortDesc' : 'sortAsc'}
                          className={clsx(
                            'size-3.5 transition-opacity',
                            !active && 'opacity-0 group-hover/sort:opacity-60',
                          )}
                        />
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === 'Enter') onRowClick(row);
                      }
                    : undefined
                }
                className={clsx(
                  'group/row animate-rise outline-offset-[-2px]',
                  onRowClick && 'cursor-pointer',
                )}
                style={{ animationDelay: `${Math.min(index, 14) * 30}ms` }}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={clsx(
                      'px-2 py-2 align-middle transition-colors duration-150 ease-productive',
                      'group-hover/row:bg-surface-3 first:rounded-l-l last:rounded-r-l',
                      column.align === 'right' && 'text-right',
                      column.hideBelow && HIDE_CLASS[column.hideBelow],
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Pagination({
  page,
  pages,
  total,
  size,
  onPageChange,
  onSizeChange,
  /** Формы слова: одна / две / пять. */
  noun = ['запись', 'записи', 'записей'],
}: {
  page: number;
  pages: number;
  total: number;
  size: number;
  onPageChange: (page: number) => void;
  onSizeChange?: (size: number) => void;
  noun?: [string, string, string];
}) {
  if (total === 0) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(page * size, total);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="tnum text-body-s text-fg-muted">
        {from}–{to} из <span className="text-fg">{total}</span> {plural(total, noun)}
      </p>

      <div className="flex items-center gap-2">
        {onSizeChange && (
          <div className="relative">
            <select
              value={size}
              onChange={(event) => onSizeChange(Number(event.target.value))}
              aria-label="Записей на странице"
              className="h-9 cursor-pointer appearance-none rounded-m border-0 bg-neutral-container pr-9 pl-3 text-body-s font-medium text-fg transition-colors duration-150 hover:bg-neutral-container-hover"
            >
              {[25, 50, 100, 200].map((option) => (
                <option key={option} value={option}>
                  по {option}
                </option>
              ))}
            </select>
            <Icon
              name="chevronDown"
              className="pointer-events-none absolute top-2.5 right-2.5 size-4 text-fg-muted"
            />
          </div>
        )}
        <IconButton
          icon="chevronLeft"
          label="Предыдущая страница"
          size="m"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        />
        <span className="tnum min-w-14 text-center text-body-s text-fg">
          {page} / {pages || 1}
        </span>
        <IconButton
          icon="chevronRight"
          label="Следующая страница"
          size="m"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        />
      </div>
    </div>
  );
}

/** Согласование с числом: 1 запись, 2 записи, 5 записей. */
export function plural(count: number, [one, few, many]: [string, string, string]): string {
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = count % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
