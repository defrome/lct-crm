import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { interactionsApi } from '@/api/endpoints';
import { useInteractions } from '@/api/queries';
import type { InteractionRead } from '@/api/types';
import { useAuth } from '@/app/AuthProvider';
import { Page } from '@/components/layout/AppShell';
import {
  DirectionPicker,
  ProductPicker,
  UniversityPicker,
  UserPicker,
} from '@/components/pickers/EntityPickers';
import { Button } from '@/components/ui/Button';
import { DataTable, Pagination, plural, type Column } from '@/components/ui/DataTable';
import { SegmentedControl } from '@/components/ui/Field';
import { FilterBar, FilterSlot, PeriodFilter } from '@/components/ui/FilterBar';
import { EmptyState, PageHeader } from '@/components/ui/States';
import { useDebounced, useFilters } from '@/hooks';
import { useStageLookup } from '@/features/workflows/useStageLookup';
import { fetchAll } from '@/lib/fetchAll';
import { InteractionFormModal } from './InteractionFormModal';
import { KanbanBoard } from './KanbanBoard';
import { InteractionSubject, LicenseDate, ResponsibleCell, StageChip } from './parts';

const DEFAULTS = {
  q: '',
  university_id: '',
  it_direction_id: '',
  it_product_id: '',
  responsible_user_id: '',
  signed_from: '',
  signed_to: '',
  sort: '-updated_at',
  page: '1',
  size: '50',
};

type ViewMode = 'list' | 'kanban';

const VIEW_OPTIONS: { value: ViewMode; label: string; icon: ViewMode }[] = [
  { value: 'list', label: 'Список', icon: 'list' },
  { value: 'kanban', label: 'Канбан', icon: 'kanban' },
];

// Отдельно от фильтров: выбор вида — это предпочтение экрана, а не отбор
// данных, и не должно сбрасываться кнопкой «Сбросить» или пропадать при
// возврате на страницу без query-параметров.
const VIEW_STORAGE_KEY = 'crm:interactions:view';

function readStoredView(): ViewMode {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'kanban' ? 'kanban' : 'list';
  } catch {
    return 'list';
  }
}

export function InteractionsPage() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { values, set, reset, activeCount } = useFilters(DEFAULTS);
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<ViewMode>(readStoredView);
  const stages = useStageLookup();

  const search = useDebounced(values.q, 350);
  const hasPeriod = Boolean(values.signed_from || values.signed_to);

  const isKanban = view === 'kanban';

  const changeView = (next: ViewMode) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Приватный режим браузера может запрещать запись — тогда выбор
      // просто не переживёт перезагрузку, но сам переключатель работает.
    }
  };

  const filterParams = {
    search: search || undefined,
    university_id: values.university_id || undefined,
    it_direction_id: values.it_direction_id || undefined,
    it_product_id: values.it_product_id || undefined,
    responsible_user_id: values.responsible_user_id || undefined,
  };

  const { data, isPending, isFetching, error, refetch } = useInteractions({
    ...filterParams,
    sort: values.sort || undefined,
    // The API has no period parameter yet, so a period is applied below over a
    // full result set rather than over one page.
    page: hasPeriod ? 1 : Number(values.page),
    size: hasPeriod ? 200 : Number(values.size),
  });

  // Канбан показывает весь отбор целиком, а не одну страницу, — иначе
  // соседний этап мог бы просто не поместиться в загруженные 50 карточек.
  const board = useQuery({
    queryKey: ['interactions', 'kanban', filterParams, values.sort],
    queryFn: () => fetchAll(interactionsApi.list, { ...filterParams, sort: values.sort || undefined }),
    enabled: isKanban,
    placeholderData: (previous) => previous,
  });

  const rows = useMemo(() => {
    const items = data?.items ?? [];
    if (!hasPeriod) return items;
    return items.filter((row) => {
      if (!row.license_signed_at) return false;
      if (values.signed_from && row.license_signed_at < values.signed_from) return false;
      if (values.signed_to && row.license_signed_at > values.signed_to) return false;
      return true;
    });
  }, [data, hasPeriod, values.signed_from, values.signed_to]);

  const columns: Column<InteractionRead>[] = [
    {
      key: 'subject',
      header: 'Вуз, направление и продукт',
      sortKey: 'university_id',
      render: (row) => <InteractionSubject row={row} />,
      width: '30%',
    },
    {
      key: 'stage',
      header: 'Этап работы',
      render: (row) => (
        <StageChip
          info={row.current_stage_id ? stages.byStageId.get(row.current_stage_id) : undefined}
          fallback={row.transfer_status}
        />
      ),
      width: '26%',
    },
    {
      key: 'contract',
      header: 'Договор',
      sortKey: 'contract_number',
      hideBelow: 'lg',
      render: (row) =>
        row.contract_number ? (
          <span className="tnum text-desc text-fg-soft">{row.contract_number}</span>
        ) : (
          <span className="text-fg-muted">—</span>
        ),
    },
    {
      key: 'license',
      header: 'Лицензия до',
      sortKey: 'license_expires_at',
      hideBelow: 'md',
      render: (row) => <LicenseDate value={row.license_expires_at} />,
    },
    {
      key: 'responsible',
      header: 'Ответственный',
      sortKey: 'responsible_user_id',
      hideBelow: 'xl',
      render: (row) => <ResponsibleCell row={row} />,
    },
  ];

  return (
    <Page>
      <PageHeader
        title="Взаимодействия"
        meta={
          isKanban
            ? board.data && (
                <>
                  {board.data.total}{' '}
                  {plural(board.data.total, ['карточка', 'карточки', 'карточек'])}
                  {board.isFetching && ' · обновляется'}
                </>
              )
            : data && (
                <>
                  {hasPeriod ? rows.length : data.total}{' '}
                  {plural(hasPeriod ? rows.length : data.total, ['карточка', 'карточки', 'карточек'])}
                  {hasPeriod && ' за выбранный период'}
                  {isFetching && ' · обновляется'}
                </>
              )
        }
        actions={
          can('manager') && (
            <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
              Новая карточка
            </Button>
          )
        }
      />

      <div className="mt-5">
        <FilterBar
          search={values.q}
          onSearchChange={(value) => set({ q: value })}
          searchPlaceholder="Вуз, продукт, номер договора"
          activeCount={activeCount}
          onReset={reset}
          trailing={
            <SegmentedControl value={view} onChange={changeView} options={VIEW_OPTIONS} />
          }
        >
          <FilterSlot>
            <UniversityPicker
              value={values.university_id || null}
              onChange={(value) => set({ university_id: value })}
              placeholder="Любой вуз"
            />
          </FilterSlot>
          <FilterSlot>
            <DirectionPicker
              value={values.it_direction_id || null}
              onChange={(value) => set({ it_direction_id: value })}
              placeholder="Любое направление"
            />
          </FilterSlot>
          <FilterSlot>
            <ProductPicker
              value={values.it_product_id || null}
              onChange={(value) => set({ it_product_id: value })}
              placeholder="Любой продукт"
            />
          </FilterSlot>
          <FilterSlot>
            <UserPicker
              value={values.responsible_user_id || null}
              onChange={(value) => set({ responsible_user_id: value })}
              placeholder="Любой ответственный"
            />
          </FilterSlot>
          <PeriodFilter
            label="Подписание лицензии"
            from={values.signed_from || undefined}
            to={values.signed_to || undefined}
            onChange={({ from, to }) => set({ signed_from: from, signed_to: to })}
          />
        </FilterBar>
      </div>

      {isKanban ? (
        <div className="mt-4">
          <KanbanBoard
            rows={board.data?.items ?? []}
            stages={stages}
            onOpen={(id) => navigate(`/interactions/${id}`)}
            onCreate={can('manager') ? () => setCreating(true) : undefined}
            /*
             * Переводить карточку по этапам может любая роль: доска и так
             * показывает только то, что видно пользователю, а закрепление за
             * вузом проверяет сервер. Ограничение по manager здесь запрещало
             * КАМу вести собственные карточки — ровно ту работу, ради которой
             * ему и выдан доступ (FR-03).
             */
            canEdit
            emptyHint={
              can('manager')
                ? 'Заведите карточку вручную или загрузите каталог из Excel.'
                : 'Здесь появятся карточки закреплённых за вами вузов. Если список пуст, закрепление ещё не сделано — обратитесь к руководителю.'
            }
          />
        </div>
      ) : (
        <div className="card card-pad mt-4">
          <DataTable
            rows={rows}
            columns={columns}
            rowKey={(row) => row.id}
            loading={isPending || stages.isLoading}
            error={error}
            onRetry={() => void refetch()}
            sort={values.sort}
            onSortChange={(sort) => set({ sort: sort ?? '' })}
            onRowClick={(row) => navigate(`/interactions/${row.id}`)}
            renderCard={(row) => (
              <div className="flex flex-col gap-2">
                <InteractionSubject row={row} />
                <StageChip
                  info={row.current_stage_id ? stages.byStageId.get(row.current_stage_id) : undefined}
                  fallback={row.transfer_status}
                />
                <div className="flex flex-wrap items-center justify-between gap-2 text-desc">
                  <LicenseDate value={row.license_expires_at} showBadge />
                  <ResponsibleCell row={row} />
                </div>
              </div>
            )}
            empty={
              <EmptyState
                icon="cards"
                title={activeCount > 0 ? 'Под фильтры ничего не подошло' : 'Карточек пока нет'}
                message={
                  activeCount > 0
                    ? 'Снимите часть условий, чтобы увидеть больше записей.'
                    : can('manager')
                      ? 'Заведите карточку вручную или загрузите каталог из Excel.'
                      : 'Здесь появятся карточки закреплённых за вами вузов. Если список пуст, закрепление ещё не сделано — обратитесь к руководителю.'
                }
                action={
                  activeCount > 0 ? (
                    <Button onClick={reset}>Сбросить фильтры</Button>
                  ) : (
                    can('manager') && (
                      <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
                        Новая карточка
                      </Button>
                    )
                  )
                }
              />
            }
          />

          {data && !hasPeriod && (
            <Pagination
              page={data.page}
              pages={data.pages}
              total={data.total}
              size={data.size}
              noun={['карточка', 'карточки', 'карточек']}
              onPageChange={(page) => set({ page: String(page) })}
              onSizeChange={(size) => set({ size: String(size), page: '1' })}
            />
          )}
        </div>
      )}

      <InteractionFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(created) => navigate(`/interactions/${created.id}`)}
      />
    </Page>
  );
}
