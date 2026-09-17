import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '@/api/client';
import { usersApi } from '@/api/endpoints';
import { useUniversities, useUsers } from '@/api/queries';
import type { UserRead, UserRole, UserVisibilityMode } from '@/api/types';
import { useAuth } from '@/app/AuthProvider';
import { useToast } from '@/app/ToastProvider';
import { Page } from '@/components/layout/AppShell';
import { Avatar, Badge, type Tone } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DataTable, Pagination, type Column } from '@/components/ui/DataTable';
import { Select, TextInput } from '@/components/ui/Field';
import { FilterBar } from '@/components/ui/FilterBar';
import { Modal } from '@/components/ui/Modal';
import { Blank, EmptyState, PageHeader } from '@/components/ui/States';
import { useDebounced, useFilters } from '@/hooks';
import { ROLE_HINTS, ROLE_LABELS, formatDate } from '@/lib/format';
import { UniversityPicker } from '@/components/pickers/EntityPickers';

const ROLE_TONE: Record<UserRole, Tone> = { user: 'neutral', manager: 's02', admin: 's01' };

const DEFAULTS = { q: '', sort: 'full_name', page: '1', size: '50' };

export function UsersPage() {
  const { can } = useAuth();
  const { values, set, reset, activeCount } = useFilters(DEFAULTS);
  const search = useDebounced(values.q, 350);
  const [creating, setCreating] = useState(false);
  const [visibilityUser, setVisibilityUser] = useState<UserRead | null>(null);

  const { data, isPending, error, refetch } = useUsers({
    search: search || undefined,
    sort: values.sort || undefined,
    page: Number(values.page),
    size: Number(values.size),
  });

  const columns: Column<UserRead>[] = [
    {
      key: 'name',
      header: 'Сотрудник',
      sortKey: 'full_name',
      width: '34%',
      render: (row) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar name={row.full_name} size={36} />
          <span className="min-w-0">
            <span className="block truncate text-[15px] leading-5 font-medium text-fg">
              {row.full_name}
            </span>
            {row.email && <span className="block truncate text-desc text-fg-muted">{row.email}</span>}
          </span>
        </span>
      ),
    },
    {
      key: 'visibility',
      header: 'Видимость',
      hideBelow: 'lg',
      render: (row) => <VisibilityBadge mode={row.visibility_mode} />,
    },
    {
      key: 'settings',
      header: '',
      align: 'right',
      render: (row) =>
        can('admin') && row.role === 'user' ? (
          <Button size="s" onClick={() => setVisibilityUser(row)}>
            Доступ
          </Button>
        ) : null,
    },
    {
      key: 'role',
      header: 'Роль',
      sortKey: 'role',
      render: (row) => (
        <span className="flex flex-col items-start gap-1">
          <Badge tone={ROLE_TONE[row.role]}>{ROLE_LABELS[row.role]}</Badge>
          <span className="hidden text-desc text-fg-muted lg:block">{ROLE_HINTS[row.role]}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Статус',
      hideBelow: 'sm',
      render: (row) =>
        row.is_active ? (
          <Badge tone="success">
            активен
          </Badge>
        ) : (
          <Badge>отключён</Badge>
        ),
    },
    {
      key: 'keycloak',
      header: 'Keycloak ID',
      hideBelow: 'xl',
      render: (row) => (
        <span className="tnum truncate text-desc text-fg-muted">{row.keycloak_id}</span>
      ),
    },
    {
      key: 'created',
      header: 'Заведён',
      sortKey: 'created_at',
      hideBelow: 'lg',
      render: (row) => (
        <span className="tnum text-desc text-fg-soft">{formatDate(row.created_at)}</span>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Сотрудники"
        meta="Локальная проекция учётных записей Keycloak. Роли выдаются в Keycloak."
        actions={
          can('admin') && (
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              Завести сотрудника
            </Button>
          )
        }
      />

      <div className="mt-5">
        <FilterBar
          search={values.q}
          onSearchChange={(value) => set({ q: value })}
          searchPlaceholder="ФИО или email"
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
          renderCard={(row) => (
            <div className="flex items-center gap-3">
              <Avatar name={row.full_name} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-s text-fg">{row.full_name}</span>
                <span className="block truncate text-desc text-fg-muted">
                  {row.email ?? <Blank />}
                </span>
              </span>
              <Badge tone={ROLE_TONE[row.role]}>{ROLE_LABELS[row.role]}</Badge>
            </div>
          )}
          empty={
            <EmptyState
              icon="users"
              title="Сотрудники не найдены"
              message="Учётные записи появляются здесь после первого входа через Keycloak."
            />
          }
        />

        {data && (
          <Pagination
            page={data.page}
            pages={data.pages}
            total={data.total}
            size={data.size}
            noun={['сотрудник', 'сотрудника', 'сотрудников']}
            onPageChange={(page) => set({ page: String(page) })}
            onSizeChange={(size) => set({ size: String(size), page: '1' })}
          />
        )}
      </div>

      <UserFormModal open={creating} onClose={() => setCreating(false)} />
      <VisibilityModal key={visibilityUser?.id ?? 'none'} user={visibilityUser} onClose={() => setVisibilityUser(null)} />
    </Page>
  );
}

function VisibilityBadge({ mode }: { mode: UserVisibilityMode }) {
  const labels: Record<UserVisibilityMode, string> = {
    assignments: 'По закреплению',
    selected: 'Выбранные вузы',
    all: 'Все вузы',
  };
  return <span className="text-desc text-fg-muted">{labels[mode]}</span>;
}

function VisibilityModal({ user, onClose }: { user: UserRead | null; onClose: () => void }) {
  const toast = useToast();
  const client = useQueryClient();
  const [draft, setDraft] = useState<{ mode: UserVisibilityMode; universityIds: string[] } | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const settings = useQuery({
    queryKey: ['users', user?.id, 'visibility'],
    queryFn: () => usersApi.visibility(user!.id),
    enabled: Boolean(user),
  });
  const universities = useUniversities({ size: 200, sort: 'name' });

  const loaded = settings.data;
  const mode = draft?.mode ?? loaded?.mode ?? 'assignments';
  const universityIds = draft?.universityIds ?? loaded?.university_ids ?? [];
  const names = new Map((universities.data?.items ?? []).map((item) => [item.id, item.name]));

  const updateDraft = (next: Partial<{ mode: UserVisibilityMode; universityIds: string[] }>) =>
    setDraft({ mode, universityIds, ...next });

  const save = useMutation({
    mutationFn: () =>
      usersApi.updateVisibility(user!.id, { mode, university_ids: universityIds }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['users'] });
      void client.invalidateQueries({ queryKey: ['users', user?.id, 'visibility'] });
      toast.notify('Настройки видимости сохранены');
      onClose();
    },
    onError: (error) => toast.fail(error, 'Не удалось сохранить настройки доступа'),
  });

  return (
    <Modal
      open={Boolean(user)}
      onClose={onClose}
      title="Видимость данных"
      description={user ? `Настройки КАМа: ${user.full_name}` : undefined}
      footer={
        <>
          <Button onClick={onClose} disabled={save.isPending}>Отмена</Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={settings.isPending || (mode === 'selected' && universityIds.length === 0)}
            onClick={() => save.mutate()}
          >
            Сохранить
          </Button>
        </>
      }
    >
      {settings.isPending ? (
        <p className="text-body-s text-fg-muted">Загрузка настроек...</p>
      ) : (
        <div className="flex flex-col gap-4">
          <Select
            label="Правило доступа"
            value={mode}
            onChange={(event) => updateDraft({ mode: event.target.value as UserVisibilityMode })}
            options={[
              { value: 'assignments', label: 'Только закреплённые вузы' },
              { value: 'selected', label: 'Только выбранные вузы' },
              { value: 'all', label: 'Все вузы' },
            ]}
            hint="Роль сотрудника назначается в Keycloak; здесь задаётся только граница видимости данных."
          />
          {mode === 'selected' && (
            <>
              <UniversityPicker
                label="Добавить вуз"
                value={adding}
                onChange={setAdding}
                placeholder="Найдите вуз"
              />
              <Button
                size="m"
                disabled={!adding || universityIds.includes(adding)}
                onClick={() => {
                  if (adding) updateDraft({ universityIds: [...universityIds, adding] });
                  setAdding(null);
                }}
              >
                Добавить в список
              </Button>
              <ul className="flex flex-col gap-2">
                {universityIds.map((id) => (
                  <li key={id} className="flex items-center justify-between gap-3 rounded-l bg-surface-3 px-3 py-2">
                    <span className="min-w-0 truncate text-body-s text-fg">{names.get(id) ?? id}</span>
                    <Button size="s" onClick={() => updateDraft({ universityIds: universityIds.filter((item) => item !== id) })}>
                      Убрать
                    </Button>
                  </li>
                ))}
              </ul>
              {universityIds.length === 0 && <p className="text-desc text-fg-muted">Добавьте хотя бы один вуз.</p>}
            </>
          )}
        </div>
      )}
    </Modal>
  );
}

function UserFormModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const client = useQueryClient();
  const [keycloakId, setKeycloakId] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('user');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: () =>
      usersApi.create({
        keycloak_id: keycloakId.trim(),
        full_name: fullName.trim(),
        email: email.trim() || null,
        role,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['users'] });
      toast.notify('Сотрудник заведён');
      setKeycloakId('');
      setFullName('');
      setEmail('');
      setRole('user');
      onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError) setFieldErrors(error.fieldErrors);
      toast.fail(error, 'Не удалось завести сотрудника');
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Завести сотрудника вручную"
      description="Обычно запись создаётся сама при первом входе — это запасной путь"
      footer={
        <>
          <Button onClick={onClose} disabled={save.isPending}>
            Отмена
          </Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={!keycloakId.trim() || !fullName.trim()}
            onClick={() => save.mutate()}
          >
            Завести
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextInput
          label="ФИО"
          required
          autoFocus
          placeholder="Петрова Анна Сергеевна"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          error={fieldErrors.full_name}
        />
        <TextInput
          label="Keycloak ID"
          required
          mono
          hint="Идентификатор или имя пользователя в реалме crm"
          value={keycloakId}
          onChange={(event) => setKeycloakId(event.target.value)}
          error={fieldErrors.keycloak_id}
        />
        <TextInput
          label="Рабочий email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
        />
        <Select
          label="Роль"
          value={role}
          onChange={(event) => setRole(event.target.value as UserRole)}
          options={(['user', 'manager', 'admin'] as UserRole[]).map((value) => ({
            value,
            label: ROLE_LABELS[value],
          }))}
          hint={ROLE_HINTS[role]}
        />
      </div>
    </Modal>
  );
}
