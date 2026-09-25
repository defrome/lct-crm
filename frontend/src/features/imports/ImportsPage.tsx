import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { importsApi } from '@/api/endpoints';
import { useImportJobs } from '@/api/queries';
import type { ImportJobRead, ImportJobStatus } from '@/api/types';
import { useToast } from '@/app/ToastProvider';
import { Page } from '@/components/layout/AppShell';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { DataTable, Pagination, type Column } from '@/components/ui/DataTable';
import { FilterBar } from '@/components/ui/FilterBar';
import { Icon } from '@/components/ui/Icon';
import { ConfirmModal } from '@/components/ui/Modal';
import { EmptyState, PageHeader } from '@/components/ui/States';
import { useDebounced, useFilters } from '@/hooks';
import { formatDateTime } from '@/lib/format';
import { TARGET_OPTIONS } from './fields';

const STATUS: Record<ImportJobStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Ждёт маппинга', tone: 'neutral' },
  validated: { label: 'Проверен', tone: 's02' },
  committed: { label: 'Записан', tone: 'success' },
  failed: { label: 'Ошибка', tone: 'error' },
  cancelled: { label: 'Отменён', tone: 'neutral' },
};

const DEFAULTS = { q: '', sort: '-created_at', page: '1', size: '50' };

export function ImportsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const client = useQueryClient();
  const { values, set, reset, activeCount } = useFilters(DEFAULTS);
  const search = useDebounced(values.q, 350);
  const [deleting, setDeleting] = useState<ImportJobRead | null>(null);

  const { data, isPending, error, refetch } = useImportJobs({
    search: search || undefined,
    sort: values.sort || undefined,
    page: Number(values.page),
    size: Number(values.size),
  });

  const remove = useMutation({
    mutationFn: () => importsApi.remove(deleting!.id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['imports'] });
      toast.notify('Каталог удалён из истории импортов');
      setDeleting(null);
    },
    onError: (mutationError) => toast.fail(mutationError, 'Не удалось удалить каталог'),
  });

  const columns: Column<ImportJobRead>[] = [
    {
      key: 'file',
      header: 'Файл',
      sortKey: 'filename',
      width: '34%',
      render: (row) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Icon name="file" className="size-4 shrink-0 text-fg-muted" />
          <span className="min-w-0">
            <span className="block truncate text-body-s text-fg">{row.filename}</span>
            <span className="block truncate text-desc text-fg-muted">
              {TARGET_OPTIONS.find((option) => option.value === row.target)?.label ?? row.target}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Состояние',
      render: (row) => {
        const status = STATUS[row.status];
        return (
          <span className="flex flex-col gap-1">
            <Badge tone={status.tone}>{status.label}</Badge>
            {row.error_message && (
              <span className="text-desc text-error">{row.error_message}</span>
            )}
          </span>
        );
      },
    },
    {
      key: 'stats',
      header: 'Результат',
      hideBelow: 'md',
      render: (row) => {
        const stats = row.stats ?? {};
        if (row.status === 'committed') {
          return (
            <span className="tnum text-desc text-fg-soft">
              +{stats.created ?? 0} / ~{stats.updated ?? 0}
              {(stats.skipped ?? 0) > 0 && (
                <span className="text-warning"> / −{stats.skipped}</span>
              )}
            </span>
          );
        }
        if (stats.total) {
          return (
            <span className="tnum text-desc text-fg-muted">{stats.total} строк</span>
          );
        }
        return <span className="text-fg-muted">—</span>;
      },
    },
    {
      key: 'created',
      header: 'Загружен',
      sortKey: 'created_at',
      hideBelow: 'lg',
      render: (row) => (
        <span className="tnum text-desc text-fg-soft">
          {formatDateTime(row.created_at)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Действия',
      width: '1%',
      align: 'right',
      render: (row) => (
        <IconButton
          icon="trash"
          label={`Удалить каталог «${row.filename}»`}
          size="m"
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation();
            setDeleting(row);
          }}
        />
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Импорт каталогов"
        meta="Загрузка → маппинг → предпросмотр → запись. Данные меняются только после подтверждения."
        actions={
          <Button variant="primary" icon="import" onClick={() => navigate('/imports/new')}>
            Загрузить файл
          </Button>
        }
      />

      <div className="mt-5">
        <FilterBar
          search={values.q}
          onSearchChange={(value) => set({ q: value })}
          searchPlaceholder="Имя файла"
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
          onRowClick={(row) => navigate(`/imports/${row.id}`)}
          renderCard={(row) => (
            <div className="flex flex-col gap-2">
              <span className="truncate text-body-s text-fg">{row.filename}</span>
              <span className="flex items-center justify-between gap-2">
                <Badge tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Badge>
                <span className="flex items-center gap-1">
                  <span className="tnum text-desc text-fg-muted">
                    {formatDateTime(row.created_at)}
                  </span>
                  <IconButton
                    icon="trash"
                    label={`Удалить каталог «${row.filename}»`}
                    size="m"
                    variant="ghost"
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleting(row);
                    }}
                  />
                </span>
              </span>
            </div>
          )}
          empty={
            <EmptyState
              icon="import"
              title="Импортов пока не было"
              message="Загрузите .xlsx, .xls или .json — система покажет, что изменится, до записи."
              action={
                <Button variant="primary" icon="import" onClick={() => navigate('/imports/new')}>
                  Загрузить файл
                </Button>
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
            noun={['импорт', 'импорта', 'импортов']}
            onPageChange={(page) => set({ page: String(page) })}
            onSizeChange={(size) => set({ size: String(size), page: '1' })}
          />
        )}
      </div>

      <ConfirmModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        danger
        title="Удалить каталог?"
        confirmLabel="Удалить"
        message={
          deleting ? (
            <>
              Каталог «{deleting.filename}» исчезнет из истории импортов. Уже созданные или
              обновлённые записи CRM останутся без изменений.
            </>
          ) : null
        }
      />
    </Page>
  );
}
