import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { workflowsApi } from '@/api/endpoints';
import { useWorkflows } from '@/api/queries';
import type { WorkflowRead } from '@/api/types';
import { useAuth } from '@/app/AuthProvider';
import { useToast } from '@/app/ToastProvider';
import { Page } from '@/components/layout/AppShell';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { Checkbox, TextArea, TextInput } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, PageHeader } from '@/components/ui/States';
import { formatDate } from '@/lib/format';

export function WorkflowsPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [creating, setCreating] = useState(false);
  // API сортирует только по name — процесс по умолчанию поднимаем наверх сами.
  const { data, isPending, error, refetch } = useWorkflows({ size: 100, sort: 'name' });
  const rows = [...(data?.items ?? [])].sort(
    (left, right) => Number(right.is_default) - Number(left.is_default),
  );

  const columns: Column<WorkflowRead>[] = [
    {
      key: 'name',
      header: 'Процесс',
      width: '46%',
      render: (row) => (
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-body-s font-medium text-fg">{row.name}</span>
            {row.is_default && (
              <Badge tone="s01">
                <Icon name="flag" className="size-3.5" />
                по умолчанию
              </Badge>
            )}
            {!row.is_active && <Badge>архив</Badge>}
          </span>
          {row.description && (
            <span className="line-clamp-2 text-desc text-fg-muted">
              {row.description}
            </span>
          )}
        </span>
      ),
    },
    {
      key: 'created',
      header: 'Создан',
      hideBelow: 'md',
      render: (row) => (
        <span className="tnum text-desc text-fg-soft">{formatDate(row.created_at)}</span>
      ),
    },
    {
      key: 'open',
      header: '',
      align: 'right',
      width: '140px',
      render: () => (
        <span className="inline-flex items-center gap-1 text-body-s text-fg-muted">
          Открыть
          <Icon name="chevronRight" className="size-3.5" />
        </span>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Процессы"
        meta="Маршруты, по которым карточки идут от первого контакта до результата"
        actions={
          can('manager') && (
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              Новый процесс
            </Button>
          )
        }
      />

      <div className="card card-pad mt-4">
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(row) => row.id}
          loading={isPending}
          error={error}
          onRetry={() => void refetch()}
          onRowClick={(row) => navigate(`/workflows/${row.id}`)}
          renderCard={(row) => (
            <div className="flex flex-col gap-1.5">
              <span className="text-body-s font-medium text-fg">{row.name}</span>
              {row.is_default && <Badge tone="s01">по умолчанию</Badge>}
            </div>
          )}
          empty={
            <EmptyState
              icon="route"
              title="Процессов пока нет"
              message="Базовый процесс из 14 шагов создаётся при первом запуске сервиса. Здесь можно завести свой."
              action={
                can('manager') && (
                  <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
                    Новый процесс
                  </Button>
                )
              }
            />
          }
        />
      </div>

      <WorkflowFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(created) => navigate(`/workflows/${created.id}`)}
      />
    </Page>
  );
}

export function WorkflowFormModal({
  open,
  onClose,
  record,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  record?: WorkflowRead;
  onCreated?: (created: WorkflowRead) => void;
}) {
  const toast = useToast();
  const client = useQueryClient();
  const [name, setName] = useState(record?.name ?? '');
  const [description, setDescription] = useState(record?.description ?? '');
  const [isDefault, setIsDefault] = useState(record?.is_default ?? false);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        is_default: isDefault,
      };
      return record ? workflowsApi.update(record.id, body) : workflowsApi.create(body);
    },
    onSuccess: (saved) => {
      void client.invalidateQueries({ queryKey: ['workflows'] });
      toast.notify(record ? 'Процесс сохранён' : 'Процесс создан');
      onClose();
      if (!record) onCreated?.(saved);
    },
    onError: (error) => toast.fail(error, 'Не удалось сохранить процесс'),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={record ? 'Изменить процесс' : 'Новый процесс'}
      description="После создания у процесса появится черновик версии — в нём задаются этапы"
      footer={
        <>
          <Button onClick={onClose} disabled={save.isPending}>
            Отмена
          </Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={name.trim().length === 0}
            onClick={() => save.mutate()}
          >
            {record ? 'Сохранить' : 'Создать процесс'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextInput
          label="Название"
          required
          autoFocus
          placeholder="Работа с колледжами"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextArea
          label="Описание"
          rows={3}
          placeholder="Для кого этот маршрут и чем отличается от базового"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <Checkbox
          label="Процесс по умолчанию"
          hint="Новые карточки будут вставать на этот маршрут"
          checked={isDefault}
          onChange={(event) => setIsDefault(event.target.checked)}
        />
      </div>
    </Modal>
  );
}

