// oxlint-disable react/set-state-in-effect
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { NavLink, Navigate, useNavigate, useParams } from 'react-router-dom';

import { directionsApi, productsApi, vendorsApi } from '@/api/endpoints';
import { useContacts, useDirections, useProducts, useVendors } from '@/api/queries';
import type { ContactRead, DirectionRead, ProductRead, VendorRead } from '@/api/types';
import { useAuth } from '@/app/AuthProvider';
import { useToast } from '@/app/ToastProvider';
import { Page } from '@/components/layout/AppShell';
import { VendorPicker } from '@/components/pickers/EntityPickers';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton, chipClass } from '@/components/ui/Button';
import { DataTable, Pagination, type Column } from '@/components/ui/DataTable';
import { Checkbox, TextArea, TextInput } from '@/components/ui/Field';
import { FilterBar } from '@/components/ui/FilterBar';
import { Icon } from '@/components/ui/Icon';
import { ConfirmModal, Modal } from '@/components/ui/Modal';
import { Blank, EmptyState, PageHeader } from '@/components/ui/States';
import { useDebounced, useFilters } from '@/hooks';

type TabKey = 'products' | 'directions' | 'vendors' | 'contacts';

const TABS: { key: TabKey; label: string; noun: [string, string, string] }[] = [
  { key: 'products', label: 'ИТ-продукты', noun: ['продукт', 'продукта', 'продуктов'] },
  { key: 'directions', label: 'ИТ-направления', noun: ['направление', 'направления', 'направлений'] },
  { key: 'vendors', label: 'Вендоры', noun: ['вендор', 'вендора', 'вендоров'] },
  { key: 'contacts', label: 'Контакты вузов', noun: ['контакт', 'контакта', 'контактов'] },
];

const DEFAULTS = { q: '', sort: 'name', page: '1', size: '50' };

export function CatalogsPage() {
  const { tab } = useParams<{ tab?: string }>();
  const active = TABS.find((item) => item.key === tab)?.key;

  if (!active) return <Navigate to="/catalogs/products" replace />;

  return (
    <Page>
      <PageHeader
        title="Справочники"
        meta="Продукты, направления и вендоры, на которые ссылаются карточки взаимодействий"
      />

      <nav aria-label="Справочники" className="-my-1 mb-5 flex gap-2 overflow-x-auto py-1 [scrollbar-width:none]">
        {TABS.map((item) => (
          <NavLink
            key={item.key}
            to={`/catalogs/${item.key}`}
            className={({ isActive }) => chipClass({ size: 'm', selected: isActive })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-4">
        {active === 'products' && <ProductsTab />}
        {active === 'directions' && <DirectionsTab />}
        {active === 'vendors' && <VendorsTab />}
        {active === 'contacts' && <ContactsTab />}
      </div>
    </Page>
  );
}

/** Shared chrome: search strip, table card and pager, so the tabs stay identical. */
function CatalogFrame({
  search,
  onSearchChange,
  searchPlaceholder,
  activeCount,
  onReset,
  action,
  table,
  page,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  activeCount: number;
  onReset: () => void;
  action?: React.ReactNode;
  table: React.ReactNode;
  page?: { page: number; pages: number; total: number; size: number } & {
    noun: [string, string, string];
    onPageChange: (page: number) => void;
    onSizeChange: (size: number) => void;
  };
}) {
  return (
    <>
      <FilterBar
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder={searchPlaceholder}
        activeCount={activeCount}
        onReset={onReset}
        trailing={action}
      >
        {null}
      </FilterBar>

      <div className="card card-pad mt-4">
        {table}
        {page && <Pagination {...page} />}
      </div>
    </>
  );
}

// --- ИТ-продукты -------------------------------------------------------------

function ProductsTab() {
  const { can } = useAuth();
  const { values, set, reset, activeCount } = useFilters(DEFAULTS);
  const search = useDebounced(values.q, 350);
  const [editing, setEditing] = useState<ProductRead | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<ProductRead | null>(null);

  const { data, isPending, error, refetch } = useProducts({
    search: search || undefined,
    sort: values.sort || undefined,
    page: Number(values.page),
    size: Number(values.size),
  });

  const columns: Column<ProductRead>[] = [
    {
      key: 'name',
      header: 'Продукт',
      sortKey: 'name',
      width: '34%',
      render: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body-s font-medium text-fg">{row.name}</span>
          {row.description && (
            <span className="truncate text-desc text-fg-muted">{row.description}</span>
          )}
        </span>
      ),
    },
    {
      key: 'vendor',
      header: 'Вендор',
      render: (row) => row.vendor?.name ?? <Blank />,
    },
    {
      key: 'directions',
      header: 'Направления',
      hideBelow: 'lg',
      render: (row) =>
        row.directions?.length ? (
          <span className="flex flex-wrap gap-1">
            {row.directions.map((direction) => (
              <Badge key={direction.id}>{direction.name}</Badge>
            ))}
          </span>
        ) : (
          <Blank />
        ),
    },
    {
      key: 'active',
      header: 'Статус',
      hideBelow: 'sm',
      render: (row) =>
        row.is_active ? (
          <Badge tone="success">
            активен
          </Badge>
        ) : (
          <Badge>архив</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '90px',
      render: (row) =>
        can('manager') && (
          <span className="flex justify-end gap-1">
            <IconButton
              icon="edit"
              label={`Изменить ${row.name}`}
              size="m"
              onClick={() => setEditing(row)}
            />
            {can('admin') && (
              <IconButton
                icon="trash"
                label={`Удалить ${row.name}`}
                size="m"
                onClick={() => setRemoving(row)}
              />
            )}
          </span>
        ),
    },
  ];

  return (
    <>
      <CatalogFrame
        search={values.q}
        onSearchChange={(value) => set({ q: value })}
        searchPlaceholder="Название продукта или вендор"
        activeCount={activeCount}
        onReset={reset}
        action={
          can('manager') && (
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              Новый продукт
            </Button>
          )
        }
        table={
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
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-s font-medium text-fg">{row.name}</span>
                  {row.description && (
                    <span className="block truncate text-desc text-fg-muted">
                      {row.description}
                    </span>
                  )}
                  <span className="mt-1.5 flex flex-wrap items-center gap-1">
                    {row.vendor && <Badge>{row.vendor.name}</Badge>}
                    {row.directions?.map((direction) => (
                      <Badge key={direction.id}>{direction.name}</Badge>
                    ))}
                    <Badge tone={row.is_active ? 'success' : undefined}>
                      {row.is_active ? 'активен' : 'архив'}
                    </Badge>
                  </span>
                </span>
                {can('manager') && (
                  <span className="flex shrink-0 gap-1">
                    <IconButton
                      icon="edit"
                      label={`Изменить ${row.name}`}
                      size="m"
                      onClick={() => setEditing(row)}
                    />
                    {can('admin') && (
                      <IconButton
                        icon="trash"
                        label={`Удалить ${row.name}`}
                        size="m"
                        onClick={() => setRemoving(row)}
                      />
                    )}
                  </span>
                )}
              </div>
            )}
            empty={
              <EmptyState
                icon="catalog"
                title={activeCount > 0 ? 'Продукты не найдены' : 'Продуктов пока нет'}
                message={
                  activeCount > 0
                    ? 'Попробуйте другое название.'
                    : 'Добавьте ИТ-продукт или загрузите справочник из Excel.'
                }
              />
            }
          />
        }
        page={
          data && {
            page: data.page,
            pages: data.pages,
            total: data.total,
            size: data.size,
            noun: ['продукт', 'продукта', 'продуктов'],
            onPageChange: (page) => set({ page: String(page) }),
            onSizeChange: (size) => set({ size: String(size), page: '1' }),
          }
        }
      />

      <ProductFormModal
        open={creating || Boolean(editing)}
        record={editing ?? undefined}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />

      <DeleteCatalogModal
        record={removing}
        onClose={() => setRemoving(null)}
        remove={(id) => productsApi.remove(id)}
        invalidate={['products']}
        title="Удалить продукт?"
        describe={(row) => `«${row.name}» перестанет предлагаться в карточках взаимодействий.`}
      />
    </>
  );
}

function ProductFormModal({
  open,
  record,
  onClose,
}: {
  open: boolean;
  record?: ProductRead;
  onClose: () => void;
}) {
  const toast = useToast();
  const client = useQueryClient();
  const directions = useDirections({ size: 200, sort: 'name' });

  const [name, setName] = useState('');
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [directionIds, setDirectionIds] = useState<string[]>([]);

  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    if (!open) return;
    setName(record?.name ?? '');
    setVendorId(record?.vendor_id ?? null);
    setDescription(record?.description ?? '');
    setIsActive(record?.is_active ?? true);
    setDirectionIds(record?.directions?.map((direction) => direction.id) ?? []);
  }, [open, record]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        vendor_id: vendorId,
        description: description.trim() || null,
        is_active: isActive,
        direction_ids: directionIds,
      };
      return record ? productsApi.update(record.id, body) : productsApi.create(body);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['products'] });
      toast.notify(record ? 'Продукт сохранён' : 'Продукт создан');
      onClose();
    },
    onError: (error) => toast.fail(error, 'Не удалось сохранить продукт'),
  });

  const toggleDirection = (id: string) =>
    setDirectionIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={record ? 'Изменить продукт' : 'Новый ИТ-продукт'}
      description="Программа, курс или лицензия, которую передают вузу"
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
            {record ? 'Сохранить' : 'Создать продукт'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextInput
          label="Название"
          required
          autoFocus
          placeholder="Astra Linux Special Edition"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <VendorPicker label="Вендор" value={vendorId} onChange={setVendorId} />
        <TextArea
          label="Описание"
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />

        <div>
          <p className="mb-2 text-body-s font-medium text-fg-soft">ИТ-направления</p>
          {directions.data?.items.length ? (
            <div className="flex flex-col gap-2 rounded-m border border-line-muted p-3">
              {directions.data.items.map((direction) => (
                <Checkbox
                  key={direction.id}
                  label={direction.name}
                  checked={directionIds.includes(direction.id)}
                  onChange={() => toggleDirection(direction.id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-desc text-fg-muted">
              Справочник направлений пуст — сначала заведите направление.
            </p>
          )}
        </div>

        <Checkbox
          label="Активен"
          hint="Неактивные продукты не предлагаются при создании карточек"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
        />
      </div>
    </Modal>
  );
}

// --- ИТ-направления ----------------------------------------------------------

function DirectionsTab() {
  const { can } = useAuth();
  const { values, set, reset, activeCount } = useFilters(DEFAULTS);
  const search = useDebounced(values.q, 350);
  const [editing, setEditing] = useState<DirectionRead | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<DirectionRead | null>(null);

  const { data, isPending, error, refetch } = useDirections({
    search: search || undefined,
    sort: values.sort || undefined,
    page: Number(values.page),
    size: Number(values.size),
  });

  const columns: Column<DirectionRead>[] = [
    { key: 'name', header: 'Направление', sortKey: 'name', width: '30%', render: (row) => (
      <span className="text-body-s font-medium text-fg">{row.name}</span>
    ) },
    { key: 'description', header: 'Описание', render: (row) => row.description ?? <Blank /> },
    {
      key: 'active',
      header: 'Статус',
      hideBelow: 'sm',
      render: (row) =>
        row.is_active ? (
          <Badge tone="success">
            активно
          </Badge>
        ) : (
          <Badge>архив</Badge>
        ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '90px',
      render: (row) =>
        can('manager') && (
          <span className="flex justify-end gap-1">
            <IconButton icon="edit" label={`Изменить ${row.name}`} size="m" onClick={() => setEditing(row)} />
            {can('admin') && (
              <IconButton icon="trash" label={`Удалить ${row.name}`} size="m" onClick={() => setRemoving(row)} />
            )}
          </span>
        ),
    },
  ];

  return (
    <>
      <CatalogFrame
        search={values.q}
        onSearchChange={(value) => set({ q: value })}
        searchPlaceholder="Название направления"
        activeCount={activeCount}
        onReset={reset}
        action={
          can('manager') && (
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              Новое направление
            </Button>
          )
        }
        table={
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
              <div className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-s font-medium text-fg">{row.name}</span>
                  {row.description && (
                    <span className="block truncate text-desc text-fg-muted">
                      {row.description}
                    </span>
                  )}
                  <Badge tone={row.is_active ? 'success' : undefined} className="mt-1.5">
                    {row.is_active ? 'активно' : 'архив'}
                  </Badge>
                </span>
                {can('manager') && (
                  <span className="flex shrink-0 gap-1">
                    <IconButton
                      icon="edit"
                      label={`Изменить ${row.name}`}
                      size="m"
                      onClick={() => setEditing(row)}
                    />
                    {can('admin') && (
                      <IconButton
                        icon="trash"
                        label={`Удалить ${row.name}`}
                        size="m"
                        onClick={() => setRemoving(row)}
                      />
                    )}
                  </span>
                )}
              </div>
            )}
            empty={
              <EmptyState
                icon="catalog"
                title="Направлений пока нет"
                message="DevOps, QA, Data Science, информационная безопасность и другие области."
              />
            }
          />
        }
        page={
          data && {
            page: data.page,
            pages: data.pages,
            total: data.total,
            size: data.size,
            noun: ['направление', 'направления', 'направлений'],
            onPageChange: (page) => set({ page: String(page) }),
            onSizeChange: (size) => set({ size: String(size), page: '1' }),
          }
        }
      />

      <SimpleNameModal
        open={creating || Boolean(editing)}
        record={editing ?? undefined}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? 'Изменить направление' : 'Новое ИТ-направление'}
        description="Большая область обучения или работы"
        placeholder="DevOps"
        withDescription
        withActive
        save={(body, id) =>
          id ? directionsApi.update(id, body) : directionsApi.create({ name: body.name!, ...body })
        }
        invalidate={['directions']}
      />

      <DeleteCatalogModal
        record={removing}
        onClose={() => setRemoving(null)}
        remove={(id) => directionsApi.remove(id)}
        invalidate={['directions']}
        title="Удалить направление?"
        describe={(row) => `«${row.name}» перестанет предлагаться в карточках и продуктах.`}
      />
    </>
  );
}

// --- Вендоры -----------------------------------------------------------------

function VendorsTab() {
  const { can } = useAuth();
  const { values, set, reset, activeCount } = useFilters(DEFAULTS);
  const search = useDebounced(values.q, 350);
  const [editing, setEditing] = useState<VendorRead | null>(null);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<VendorRead | null>(null);

  const { data, isPending, error, refetch } = useVendors({
    search: search || undefined,
    sort: values.sort || undefined,
    page: Number(values.page),
    size: Number(values.size),
  });

  const columns: Column<VendorRead>[] = [
    { key: 'name', header: 'Вендор', sortKey: 'name', render: (row) => (
      <span className="text-body-s font-medium text-fg">{row.name}</span>
    ) },
    {
      key: 'actions',
      header: '',
      align: 'right',
      width: '90px',
      render: (row) =>
        can('manager') && (
          <span className="flex justify-end gap-1">
            <IconButton icon="edit" label={`Изменить ${row.name}`} size="m" onClick={() => setEditing(row)} />
            {can('admin') && (
              <IconButton icon="trash" label={`Удалить ${row.name}`} size="m" onClick={() => setRemoving(row)} />
            )}
          </span>
        ),
    },
  ];

  return (
    <>
      <CatalogFrame
        search={values.q}
        onSearchChange={(value) => set({ q: value })}
        searchPlaceholder="Название вендора"
        activeCount={activeCount}
        onReset={reset}
        action={
          can('manager') && (
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              Новый вендор
            </Button>
          )
        }
        table={
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
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-body-s font-medium text-fg">{row.name}</span>
                {can('manager') && (
                  <span className="flex shrink-0 gap-1">
                    <IconButton
                      icon="edit"
                      label={`Изменить ${row.name}`}
                      size="m"
                      onClick={() => setEditing(row)}
                    />
                    {can('admin') && (
                      <IconButton
                        icon="trash"
                        label={`Удалить ${row.name}`}
                        size="m"
                        onClick={() => setRemoving(row)}
                      />
                    )}
                  </span>
                )}
              </div>
            )}
            empty={
              <EmptyState
                icon="catalog"
                title="Вендоров пока нет"
                message="Компании, которые выпускают передаваемое ПО."
              />
            }
          />
        }
        page={
          data && {
            page: data.page,
            pages: data.pages,
            total: data.total,
            size: data.size,
            noun: ['вендор', 'вендора', 'вендоров'],
            onPageChange: (page) => set({ page: String(page) }),
            onSizeChange: (size) => set({ size: String(size), page: '1' }),
          }
        }
      />

      <SimpleNameModal
        open={creating || Boolean(editing)}
        record={editing ?? undefined}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? 'Изменить вендора' : 'Новый вендор'}
        description="Поставщик программного обеспечения"
        placeholder="Астра"
        save={(body, id) => (id ? vendorsApi.update(id, body) : vendorsApi.create({ name: body.name! }))}
        invalidate={['vendors']}
      />

      <DeleteCatalogModal
        record={removing}
        onClose={() => setRemoving(null)}
        remove={(id) => vendorsApi.remove(id)}
        invalidate={['vendors']}
        title="Удалить вендора?"
        describe={(row) => `«${row.name}» перестанет предлагаться при заведении продуктов.`}
      />
    </>
  );
}

// --- Контакты вузов ----------------------------------------------------------

function ContactsTab() {
  const navigate = useNavigate();
  const { values, set, reset, activeCount } = useFilters({ ...DEFAULTS, sort: 'full_name' });
  const search = useDebounced(values.q, 350);

  const { data, isPending, error, refetch } = useContacts({
    search: search || undefined,
    sort: values.sort || undefined,
    page: Number(values.page),
    size: Number(values.size),
  });

  const columns: Column<ContactRead>[] = [
    {
      key: 'name',
      header: 'Контактное лицо',
      sortKey: 'full_name',
      width: '30%',
      render: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-body-s font-medium text-fg">{row.full_name}</span>
          {row.position && <span className="truncate text-desc text-fg-muted">{row.position}</span>}
        </span>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      hideBelow: 'md',
      render: (row) =>
        row.email ? (
          <a
            href={`mailto:${row.email}`}
            onClick={(event) => event.stopPropagation()}
            className="text-body-s text-accent hover:underline"
          >
            {row.email}
          </a>
        ) : (
          <Blank />
        ),
    },
    {
      key: 'phone',
      header: 'Телефон',
      hideBelow: 'lg',
      render: (row) =>
        row.phone ? (
          <span className="tnum text-desc text-fg-soft">{row.phone}</span>
        ) : (
          <Blank />
        ),
    },
    {
      key: 'primary',
      header: '',
      align: 'right',
      render: (row) =>
        row.is_primary ? (
          <Badge tone="s01">
            <Icon name="flag" className="size-3.5" />
            основной
          </Badge>
        ) : null,
    },
  ];

  return (
    <CatalogFrame
      search={values.q}
      onSearchChange={(value) => set({ q: value })}
      searchPlaceholder="ФИО, должность, email"
      activeCount={activeCount}
      onReset={reset}
      table={
        <DataTable
          rows={data?.items ?? []}
          columns={columns}
          rowKey={(row) => row.id}
          loading={isPending}
          error={error}
          onRetry={() => void refetch()}
          sort={values.sort}
          onSortChange={(sort) => set({ sort: sort ?? '' })}
          onRowClick={(row) => navigate(`/universities/${row.university_id}`)}
          renderCard={(row) => (
            <div className="flex flex-col gap-1">
              <span className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body-s font-medium text-fg">
                    {row.full_name}
                  </span>
                  {row.position && (
                    <span className="block truncate text-desc text-fg-muted">{row.position}</span>
                  )}
                </span>
                {row.is_primary && (
                  <Badge tone="s01">
                    <Icon name="flag" className="size-3.5" />
                    основной
                  </Badge>
                )}
              </span>
              <span className="flex flex-wrap items-center gap-x-3 text-desc">
                {row.email && (
                  <a
                    href={`mailto:${row.email}`}
                    onClick={(event) => event.stopPropagation()}
                    className="text-accent hover:underline"
                  >
                    {row.email}
                  </a>
                )}
                {row.phone && <span className="tnum text-fg-soft">{row.phone}</span>}
              </span>
            </div>
          )}
          empty={
            <EmptyState
              icon="users"
              title="Контактов пока нет"
              message="Контакты добавляются в карточке вуза."
            />
          }
        />
      }
      page={
        data && {
          page: data.page,
          pages: data.pages,
          total: data.total,
          size: data.size,
          noun: ['контакт', 'контакта', 'контактов'],
          onPageChange: (page) => set({ page: String(page) }),
          onSizeChange: (size) => set({ size: String(size), page: '1' }),
        }
      }
    />
  );
}

// --- Общие диалоги -----------------------------------------------------------

interface NamedRecord {
  id: string;
  name: string;
  description?: string | null;
  is_active?: boolean;
}

/** Create/edit for catalogs whose whole form is a name (plus maybe a note). */
function SimpleNameModal({
  open,
  record,
  onClose,
  title,
  description,
  placeholder,
  withDescription,
  withActive,
  save,
  invalidate,
}: {
  open: boolean;
  record?: NamedRecord;
  onClose: () => void;
  title: string;
  description: string;
  placeholder: string;
  withDescription?: boolean;
  withActive?: boolean;
  save: (
    body: { name?: string; description?: string | null; is_active?: boolean },
    id?: string,
  ) => Promise<unknown>;
  invalidate: string[];
}) {
  const toast = useToast();
  const client = useQueryClient();
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [isActive, setIsActive] = useState(true);

  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    if (!open) return;
    setName(record?.name ?? '');
    setNote(record?.description ?? '');
    setIsActive(record?.is_active ?? true);
  }, [open, record]);

  const mutation = useMutation({
    mutationFn: () =>
      save(
        {
          name: name.trim(),
          ...(withDescription ? { description: note.trim() || null } : {}),
          ...(withActive ? { is_active: isActive } : {}),
        },
        record?.id,
      ),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: invalidate });
      toast.notify(record ? 'Сохранено' : 'Создано');
      onClose();
    },
    onError: (error) => toast.fail(error, 'Не удалось сохранить'),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={title}
      description={description}
      footer={
        <>
          <Button onClick={onClose} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            disabled={name.trim().length === 0}
            onClick={() => mutation.mutate()}
          >
            {record ? 'Сохранить' : 'Создать'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextInput
          label="Название"
          required
          autoFocus
          placeholder={placeholder}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        {withDescription && (
          <TextArea
            label="Описание"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        )}
        {withActive && (
          <Checkbox
            label="Активно"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
          />
        )}
      </div>
    </Modal>
  );
}

function DeleteCatalogModal<T extends { id: string; name: string }>({
  record,
  onClose,
  remove,
  invalidate,
  title,
  describe,
}: {
  record: T | null;
  onClose: () => void;
  remove: (id: string) => Promise<unknown>;
  invalidate: string[];
  title: string;
  describe: (record: T) => string;
}) {
  const toast = useToast();
  const client = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => remove(record!.id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: invalidate });
      toast.notify('Удалено');
      onClose();
    },
    onError: (error) => toast.fail(error, 'Не удалось удалить'),
  });

  return (
    <ConfirmModal
      open={Boolean(record)}
      onClose={onClose}
      onConfirm={() => mutation.mutate()}
      loading={mutation.isPending}
      danger
      title={title}
      confirmLabel="Удалить"
      message={
        record ? (
          <>
            {describe(record)} Запись останется в базе как удалённая — связанные карточки не
            пострадают.
          </>
        ) : null
      }
    />
  );
}
