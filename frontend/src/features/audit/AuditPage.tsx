import { useState } from 'react';

import { useAudit, useUsers } from '@/api/queries';
import type { AuditAction, AuditLogRead } from '@/api/types';
import { Page } from '@/components/layout/AppShell';
import { UserPicker } from '@/components/pickers/EntityPickers';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Field';
import { FilterBar, FilterSlot, PeriodFilter } from '@/components/ui/FilterBar';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/States';
import { useFilters } from '@/hooks';
import { AUDIT_LABELS, ENTITY_LABELS, entityLabel, formatDateTime } from '@/lib/format';

const ACTION_TONE: Record<AuditAction, Tone> = {
  create: 'success',
  update: 'info',
  delete: 'error',
  read_pd: 'warning',
  import: 's01',
  export: 's02',
  login: 'neutral',
  access_denied: 'error',
};


const DEFAULTS = {
  actor_id: '',
  entity_type: '',
  action: '',
  date_from: '',
  date_to: '',
  page: '1',
  size: '50',
};

export function AuditPage() {
  const { values, set, reset, activeCount } = useFilters(DEFAULTS);
  // Warms the cache so actor names resolve without a request per row.
  useUsers({ size: 200 });

  const { data, isPending, error, refetch } = useAudit({
    actor_id: values.actor_id || undefined,
    entity_type: values.entity_type || undefined,
    action: (values.action as AuditAction) || undefined,
    date_from: values.date_from || undefined,
    date_to: values.date_to || undefined,
    page: Number(values.page),
    size: Number(values.size),
  });

  return (
    <Page>
      <PageHeader
        title="Журнал аудита"
        meta="Кто, когда и что изменил. Просмотр персональных данных фиксируется отдельно."
      />

      <div className="mt-5">
        <FilterBar activeCount={activeCount} onReset={reset}>
          <FilterSlot>
            <UserPicker
              value={values.actor_id || null}
              onChange={(value) => set({ actor_id: value })}
              placeholder="Любой сотрудник"
            />
          </FilterSlot>
          <FilterSlot>
            <Select
              aria-label="Тип действия"
              placeholder="Любое действие"
              value={values.action}
              onChange={(event) => set({ action: event.target.value })}
              options={Object.entries(AUDIT_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </FilterSlot>
          <FilterSlot>
            <Select
              aria-label="Объект"
              placeholder="Любой объект"
              value={values.entity_type}
              onChange={(event) => set({ entity_type: event.target.value })}
              options={Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label }))}
            />
          </FilterSlot>
          <PeriodFilter
            label="Период"
            from={values.date_from || undefined}
            to={values.date_to || undefined}
            onChange={({ from, to }) => set({ date_from: from, date_to: to })}
          />
        </FilterBar>
      </div>

      <div className="card card-pad mt-4">
        {error ? (
          <ErrorState error={error} onRetry={() => void refetch()} />
        ) : isPending ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState
            icon="audit"
            title={activeCount > 0 ? 'Записей под фильтры нет' : 'Журнал пуст'}
            message={
              activeCount > 0
                ? 'Расширьте период или снимите часть условий.'
                : 'Здесь появятся все действия пользователей системы.'
            }
          />
        ) : (
          <ul className="-mx-2 flex flex-col">
            {data.items.map((entry) => (
              <AuditRow key={entry.id} entry={entry} />
            ))}
          </ul>
        )}

        {data && (
          <Pagination
            page={data.page}
            pages={data.pages}
            total={data.total}
            size={data.size}
            noun={['запись', 'записи', 'записей']}
            onPageChange={(page) => set({ page: String(page) })}
            onSizeChange={(size) => set({ size: String(size), page: '1' })}
          />
        )}
      </div>
    </Page>
  );
}

function AuditRow({ entry }: { entry: AuditLogRead }) {
  const [open, setOpen] = useState(false);
  const changes = entry.changes ?? {};
  const changeKeys = Object.keys(changes);
  const expandable = changeKeys.length > 0 || Boolean(entry.ip_address);

  return (
    <li>
      <button
        type="button"
        onClick={() => expandable && setOpen((previous) => !previous)}
        className={
          'flex w-full items-center gap-3 rounded-l border-0 bg-transparent px-2 py-2.5 text-left transition-colors ' +
          (expandable ? 'hover:bg-surface-3' : 'cursor-default')
        }
      >
        <Badge tone={ACTION_TONE[entry.action]}>
          {AUDIT_LABELS[entry.action]}
        </Badge>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-body-s text-fg">
            {entityLabel(entry.entity_type)}
            {changeKeys.length > 0 && (
              <span className="text-fg-muted"> · {changeKeys.length} поля</span>
            )}
          </span>
          <span className="block truncate text-desc text-fg-muted">
            {entry.actor_name ?? 'Система'}
          </span>
        </span>

        <span className="tnum hidden shrink-0 text-desc text-fg-muted sm:block">
          {formatDateTime(entry.occurred_at)}
        </span>

        {expandable && (
          <Icon name={open ? 'chevronUp' : 'chevronDown'} className="size-4 shrink-0 text-fg-muted" />
        )}
      </button>

      {open && (
        <div className="mt-1 mb-2 rounded-l bg-surface-3 px-4 py-3">
          {changeKeys.length > 0 && (
            <dl className="flex flex-col gap-1.5">
              {changeKeys.map((key) => (
                <div key={key} className="grid gap-1 text-desc sm:grid-cols-[10rem_1fr]">
                  <dt className=" text-fg-muted">{key}</dt>
                  <dd className="min-w-0 break-words text-fg">{renderChange(changes[key])}</dd>
                </div>
              ))}
            </dl>
          )}
          <p className="tnum mt-3 flex flex-wrap gap-x-4 text-desc text-fg-muted">
            <span className="sm:hidden">{formatDateTime(entry.occurred_at)}</span>
            {entry.ip_address && <span>IP {entry.ip_address}</span>}
            {entry.request_id && <span>запрос {entry.request_id.slice(0, 8)}</span>}
            {entry.entity_id && <span>объект {entry.entity_id.slice(0, 8)}</span>}
          </p>
        </div>
      )}
    </li>
  );
}

/** Audit changes arrive as `{before, after}` pairs or as a plain value. */
function renderChange(value: unknown) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const before = record.before ?? record.old;
    const after = record.after ?? record.new;
    if (before !== undefined || after !== undefined) {
      return (
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-fg-muted line-through">{stringify(before)}</span>
          <Icon name="arrowRight" className="size-3 text-fg-muted" />
          <span className="text-fg">{stringify(after)}</span>
        </span>
      );
    }
  }
  return <span>{stringify(value)}</span>;
}

function stringify(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
