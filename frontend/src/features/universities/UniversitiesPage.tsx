import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useUniversities } from '@/api/queries';
import type { UniversityRead } from '@/api/types';
import { useAuth } from '@/app/AuthProvider';
import { Page } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/Button';
import { DataTable, Pagination, type Column } from '@/components/ui/DataTable';
import { FilterBar } from '@/components/ui/FilterBar';
import { Blank, EmptyState, PageHeader } from '@/components/ui/States';
import { useDebounced, useFilters } from '@/hooks';
import { UniversityFormModal } from './UniversityFormModal';

const DEFAULTS = { q: '', sort: 'name', page: '1', size: '50' };

export function UniversitiesPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { values, set, reset, activeCount } = useFilters(DEFAULTS);
  const [creating, setCreating] = useState(false);

  const search = useDebounced(values.q, 350);
  const { data, isPending, error, refetch } = useUniversities({
    search: search || undefined,
    sort: values.sort || undefined,
    page: Number(values.page),
    size: Number(values.size),
  });

  const columns: Column<UniversityRead>[] = [
    {
      key: 'name',
      header: 'Вуз',
      sortKey: 'name',
      width: '40%',
      render: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body-s font-medium text-fg">
            {row.short_name ?? row.name}
          </span>
          {row.short_name && (
            <span className="truncate text-desc text-fg-muted">{row.name}</span>
          )}
        </span>
      ),
    },
    {
      key: 'region',
      header: 'Регион',
      sortKey: 'region',
      render: (row) => row.region ?? <Blank />,
    },
    {
      key: 'inn',
      header: 'ИНН',
      sortKey: 'inn',
      hideBelow: 'lg',
      render: (row) =>
        row.inn ? (
          <span className="tnum text-desc text-fg-soft">{row.inn}</span>
        ) : (
          <Blank />
        ),
    },
    {
      key: 'external',
      header: 'Внешний ID',
      hideBelow: 'xl',
      render: (row) =>
        row.external_id ? (
          <span className="tnum text-desc text-fg-soft">{row.external_id}</span>
        ) : (
          <Blank />
        ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Вузы"
        meta={data && `${data.total} в справочнике`}
        actions={
          can('manager') && (
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              Новый вуз
            </Button>
          )
        }
      />

      <div className="mt-5">
        <FilterBar
          search={values.q}
          onSearchChange={(value) => set({ q: value })}
          searchPlaceholder="Название, регион, ИНН"
          activeCount={activeCount}
          onReset={reset}
        >
          {null}
        </FilterBar>
      </div>

      <div className="card card-pad mt-4">
        <DataTable
          rows={data?.items ?? []}
          columns={columns}
          rowKey={(row) => row.id}
          loading={isPending}
          error={error}
          onRetry={() => void refetch()}
          sort={values.sort}
          onSortChange={(sort) => set({ sort: sort ?? '' })}
          onRowClick={(row) => navigate(`/universities/${row.id}`)}
          renderCard={(row) => (
            <div className="flex flex-col gap-1">
              <span className="text-body-s font-medium text-fg">{row.short_name ?? row.name}</span>
              <span className="text-desc text-fg-muted">{row.region ?? 'Регион не указан'}</span>
            </div>
          )}
          empty={
            <EmptyState
              icon="university"
              title={activeCount > 0 ? 'Вузы не найдены' : 'Справочник вузов пуст'}
              message={
                activeCount > 0
                  ? 'Попробуйте другое название или регион.'
                  : 'Добавьте вуз вручную или загрузите справочник из Excel.'
              }
              action={
                activeCount > 0 ? (
                  <Button onClick={reset}>Сбросить поиск</Button>
                ) : (
                  can('manager') && (
                    <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
                      Новый вуз
                    </Button>
                  )
                )
              }
            />
          }
        />

        {data && (
          <Pagination
            page={data.page}
            pages={data.pages}
            total={data.total}
            size={data.size}
            noun={['вуз', 'вуза', 'вузов']}
            onPageChange={(page) => set({ page: String(page) })}
            onSizeChange={(size) => set({ size: String(size), page: '1' })}
          />
        )}
      </div>

      <UniversityFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(created) => navigate(`/universities/${created.id}`)}
      />
    </Page>
  );
}
