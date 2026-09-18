import { useMutation, useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useMemo, type ReactNode } from 'react';

import { interactionsApi } from '@/api/endpoints';
import type { InteractionRead } from '@/api/types';
import { useToast } from '@/app/ToastProvider';
import { CategoryBars, ChartCard, SequenceBars, type Datum } from '@/components/charts/Charts';
import { Page } from '@/components/layout/AppShell';
import {
  DirectionPicker,
  ProductPicker,
  UniversityPicker,
  UserPicker,
} from '@/components/pickers/EntityPickers';
import { Button, Spinner } from '@/components/ui/Button';
import { plural } from '@/components/ui/DataTable';
import { Checkbox, Field } from '@/components/ui/Field';
import { PeriodFilter } from '@/components/ui/FilterBar';
import { Icon } from '@/components/ui/Icon';
import { Avatar, Progress } from '@/components/ui/Badge';
import { Blank, CardHeader, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/States';
import { LicenseDate, StageChip } from '@/features/interactions/parts';
import { useFilters } from '@/hooks';
import { useStageLookup, type StageInfo } from '@/features/workflows/useStageLookup';
import { fetchAll } from '@/lib/fetchAll';
import {
  exportCsv,
  exportJson,
  exportPdf,
  exportXls,
  exportXlsx,
  type ReportColumn,
} from '@/lib/exportReport';
import { formatDate, formatDateLong, licenseState, shortName } from '@/lib/format';

/**
 * The five columns named in the ТЗ (FR-05) come first and are on by default;
 * the rest are the contract details people ask for once they have the first five.
 */
const COLUMNS: (ReportColumn & { required?: boolean })[] = [
  { key: 'university', title: 'Название вуза', width: 34, required: true },
  { key: 'direction', title: 'ИТ-направление', width: 22 },
  { key: 'product', title: 'ИТ-продукт', width: 26 },
  { key: 'stage', title: 'Статус работы с вузом', width: 34 },
  { key: 'responsible', title: 'Ответственный', width: 22 },
  { key: 'contract', title: 'Номер договора', width: 18 },
  { key: 'signed', title: 'Подписание лицензии', width: 16 },
  { key: 'years', title: 'Срок, лет', width: 10 },
  { key: 'expires', title: 'Лицензия действует до', width: 16 },
  { key: 'comment', title: 'Комментарий', width: 40 },
];

const DEFAULT_KEYS = ['university', 'direction', 'product', 'stage', 'responsible'];

const DEFAULTS = {
  university_id: '',
  it_direction_id: '',
  it_product_id: '',
  responsible_user_id: '',
  signed_from: '',
  signed_to: '',
  columns: DEFAULT_KEYS.join(','),
};

export function ReportsPage() {
  const toast = useToast();
  const { values, set, reset, activeCount } = useFilters(DEFAULTS);
  const stages = useStageLookup();

  const selected = useMemo(
    () => new Set(values.columns.split(',').filter(Boolean)),
    [values.columns],
  );

  const filters = {
    university_id: values.university_id || undefined,
    it_direction_id: values.it_direction_id || undefined,
    it_product_id: values.it_product_id || undefined,
    responsible_user_id: values.responsible_user_id || undefined,
  };

  // A report covers everything that matches, not the page that happens to be open.
  const source = useQuery({
    queryKey: ['reports', 'rows', filters],
    queryFn: () => fetchAll(interactionsApi.list, filters),
    staleTime: 30_000,
  });

  const rows = useMemo(() => {
    const items = source.data?.items ?? [];
    if (!values.signed_from && !values.signed_to) return items;
    return items.filter((card) => {
      if (!card.license_signed_at) return false;
      if (values.signed_from && card.license_signed_at < values.signed_from) return false;
      if (values.signed_to && card.license_signed_at > values.signed_to) return false;
      return true;
    });
  }, [source.data, values.signed_from, values.signed_to]);

  const columns = COLUMNS.filter((column) => selected.has(column.key));

  const payload = useMemo(
    () => ({
      title: 'Отчёт по взаимодействиям с вузами',
      subtitle: describeFilters(values, rows.length),
      columns,
      rows: rows.map((card) => toRow(card, stages.byStageId)),
    }),
    [rows, columns, values, stages.byStageId],
  );

  const exporting = useMutation({
    mutationFn: async (format: 'xls' | 'xlsx' | 'pdf' | 'csv' | 'json') => {
      if (format === 'xls') return exportXls(payload);
      if (format === 'xlsx') return exportXlsx(payload);
      if (format === 'pdf') return exportPdf(payload);
      if (format === 'csv') return exportCsv(payload);
      return exportJson(payload);
    },
    onSuccess: () => toast.notify('Файл сформирован', 'Проверьте загрузки браузера'),
    onError: (error) => toast.fail(error, 'Не удалось сформировать файл'),
  });

  const toggleColumn = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    // Keep the ТЗ order, not the order the user happened to click in.
    set({
      columns: COLUMNS.filter((column) => next.has(column.key))
        .map((column) => column.key)
        .join(','),
    });
  };

  const charts = useMemo(() => buildCharts(rows, stages), [rows, stages]);

  if (source.error) {
    return (
      <Page>
        <ErrorState error={source.error} onRetry={() => void source.refetch()} />
      </Page>
    );
  }

  const busy = source.isPending || stages.isLoading;
  const summary = summarise(rows, stages.byStageId);
  const noRows = rows.length === 0;

  return (
    <Page>
      <PageHeader
        title="Отчёты"
        meta="Отберите период и разрезы, выберите колонки — и выгрузите файл"
        actions={
          <>
            {activeCount > 0 && (
              <Button variant="ghost" scheme="accent" icon="close" onClick={reset}>
                Сбросить отбор
              </Button>
            )}
            {/*
              * В шапке — только основной формат. PDF и XLS отсюда убраны: они
              * дублировали карточку «Выгрузка», из-за чего было неясно, где
              * выбирать формат, а CSV и JSON, которых в шапке никогда не было,
              * выглядели несуществующими.
              */}
            <Button
              variant="primary"
              icon="download"
              disabled={noRows}
              loading={exporting.isPending && exporting.variables === 'xlsx'}
              onClick={() => exporting.mutate('xlsx')}
            >
              Скачать XLSX
            </Button>
          </>
        }
      />

      {/* Сводка: четыре числа, которые отвечают на вопрос отчёта до таблицы. */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4 xl:grid-cols-4">
        <SummaryTile
          label="Строк в отчёте"
          value={busy ? '—' : rows.length}
          note={`${columns.length} ${plural(columns.length, ['колонка', 'колонки', 'колонок'])} · ${activeCount > 0 ? 'с отбором' : 'без отбора'}`}
        />
        <SummaryTile
          label="Вузов"
          value={busy ? '—' : summary.universities}
          note={`${summary.responsibles} ${plural(summary.responsibles, ['ответственный', 'ответственных', 'ответственных'])}`}
        />
        <SummaryTile
          label="На маршруте"
          value={busy ? '—' : summary.onRoute}
          note={`${summary.finished} на финальном этапе`}
          progress={rows.length ? summary.onRoute / rows.length : 0}
          tone="past"
        />
        <SummaryTile
          label="Лицензии истекают"
          value={busy ? '—' : summary.expiring}
          note={summary.expired > 0 ? `${summary.expired} уже истекли` : 'просроченных нет'}
          dot={summary.expired > 0 ? 'error' : summary.expiring > 0 ? 'warning' : 'success'}
        />
      </div>

      <div className="grid items-start gap-3 lg:gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="flex flex-col gap-3 lg:gap-4">
          <section className="card card-pad">
            <CardHeader title="Отбор" sub="Применяется сразу" />
            <div className="mt-5 flex flex-col gap-3">
              <Field label="Подписание лицензии">
                {() => (
                  <PeriodFilter
                    stacked
                    label="Подписание лицензии"
                    from={values.signed_from || undefined}
                    to={values.signed_to || undefined}
                    onChange={({ from, to }) => set({ signed_from: from, signed_to: to })}
                  />
                )}
              </Field>
              <UniversityPicker
                label="Вуз"
                value={values.university_id || null}
                onChange={(value) => set({ university_id: value })}
                placeholder="Все вузы"
              />
              <DirectionPicker
                label="ИТ-направление"
                value={values.it_direction_id || null}
                onChange={(value) => set({ it_direction_id: value })}
                placeholder="Все направления"
              />
              <ProductPicker
                label="ИТ-продукт"
                value={values.it_product_id || null}
                onChange={(value) => set({ it_product_id: value })}
                placeholder="Все продукты"
              />
              <UserPicker
                label="Ответственный"
                value={values.responsible_user_id || null}
                onChange={(value) => set({ responsible_user_id: value })}
                placeholder="Все ответственные"
              />
            </div>
          </section>

          <section className="card card-pad">
            <CardHeader title="Колонки" sub="Первые пять — обязательный набор по ТЗ" />
            <div className="mt-5 flex flex-col gap-3">
              {COLUMNS.map((column, index) => (
                <div key={column.key}>
                  {index === 5 && <p className="cap mt-2 mb-3">Дополнительно</p>}
                  {/*
                    * Блокируется не «обязательная» колонка, а последняя
                    * оставшаяся, какой бы она ни была: раньше «Наименование
                    * вуза» то снималось, то нет, без всякого объяснения.
                    */}
                  <Checkbox
                    label={column.title}
                    checked={selected.has(column.key)}
                    disabled={selected.has(column.key) && selected.size === 1}
                    hint={
                      selected.has(column.key) && selected.size === 1
                        ? 'В отчёте нужна хотя бы одна колонка'
                        : undefined
                    }
                    onChange={() => toggleColumn(column.key)}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="card card-pad">
            <CardHeader title="Выгрузка" sub="Любой из пяти форматов; все строки под отбором, не только видимые" />
            <div className="mt-5 flex flex-col gap-2">
              {EXPORTS.map((item) => (
                <ExportButton
                  key={item.format}
                  {...item}
                  onClick={() => exporting.mutate(item.format)}
                  busy={exporting.isPending && exporting.variables === item.format}
                  disabled={noRows}
                />
              ))}
            </div>
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-3 lg:gap-4">
          <section className="card card-pad">
            <CardHeader
              title="Предпросмотр"
              sub={
                busy
                  ? 'Собираем данные…'
                  : rows.length > PREVIEW_LIMIT
                    ? `Показаны первые ${PREVIEW_LIMIT} из ${rows.length}`
                    : `${rows.length} ${plural(rows.length, ['строка', 'строки', 'строк'])}`
              }
            />

            <div className="mt-5">
              {busy ? (
                <div className="flex flex-col gap-2">
                  {Array.from({ length: 6 }, (_, index) => (
                    <Skeleton key={index} className="h-12" />
                  ))}
                </div>
              ) : noRows ? (
                <EmptyState
                  icon="reports"
                  title="Под отбор ничего не попало"
                  message="Расширьте период или снимите часть условий."
                  action={
                    activeCount > 0 && (
                      <Button size="m" variant="primary" onClick={reset}>
                        Сбросить отбор
                      </Button>
                    )
                  }
                />
              ) : (
                <div className="-mx-2 overflow-x-auto">
                  <table className="tnum w-full border-separate border-spacing-0 text-body-s">
                    <thead>
                      <tr>
                        {columns.map((column) => (
                          <th
                            key={column.key}
                            scope="col"
                            className="bg-surface-3 px-3 py-3 text-left text-desc font-medium whitespace-nowrap text-fg-soft first:rounded-l-l last:rounded-r-l"
                          >
                            {column.title}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, PREVIEW_LIMIT).map((card) => (
                        <tr key={card.id} className="group/row">
                          {columns.map((column) => (
                            <td
                              key={column.key}
                              className="px-3 py-3 align-middle transition-colors duration-150 group-hover/row:bg-surface-3 first:rounded-l-l last:rounded-r-l"
                            >
                              <PreviewCell card={card} column={column.key} stages={stages.byStageId} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {!busy && !noRows && (
            <div className="grid items-start gap-3 lg:grid-cols-2 lg:gap-4">
              <ChartCard
                title="Распределение по этапам"
                hint="По тому же отбору, что и таблица"
                exportName="Отчёт — этапы"
                className="lg:col-span-2"
              >
                {charts.stages.length > 0 ? (
                  <SequenceBars data={charts.stages} height={260} />
                ) : (
                  <p className="py-8 text-center text-body-s text-fg-muted">
                    Ни одна карточка отбора не стоит на маршруте
                  </p>
                )}
              </ChartCard>

              <ChartCard
                title="По ИТ-направлениям"
                hint="Сколько строк в каждом"
                exportName="Отчёт — направления"
              >
                <CategoryBars data={charts.directions} tone="now" />
              </ChartCard>

              <ChartCard
                title="По ответственным"
                hint="Нагрузка в отборе"
                exportName="Отчёт — ответственные"
              >
                <CategoryBars data={charts.responsibles} tone="past" />
              </ChartCard>
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}

/** Крупное число сводки: подпись, значение Display, пояснение и, если нужно, доля. */
function SummaryTile({
  label,
  value,
  note,
  progress,
  tone = 'past',
  dot,
}: {
  label: string;
  value: ReactNode;
  note: string;
  progress?: number;
  tone?: 'past' | 'now';
  dot?: 'success' | 'warning' | 'error';
}) {
  return (
    <article className="card card-pad flex flex-col">
      <p className="cap">{label}</p>
      <p className="money mt-2">{value}</p>
      <p className="mt-2 flex items-center gap-2 text-body-s text-fg-soft">
        {dot && (
          <span
            aria-hidden="true"
            className={clsx(
              'size-2 shrink-0 rounded-full',
              dot === 'success' && 'bg-success',
              dot === 'warning' && 'bg-warning',
              dot === 'error' && 'bg-error',
            )}
          />
        )}
        {note}
      </p>
      {progress !== undefined && (
        <Progress value={progress} tone={tone} className="mt-4" label={label} />
      )}
    </article>
  );
}

/** Ячейка предпросмотра: те же бейджи и люди, что в рабочих списках, — детали видны. */
function PreviewCell({
  card,
  column,
  stages,
}: {
  card: InteractionRead;
  column: string;
  stages: Map<string, StageInfo>;
}) {
  switch (column) {
    case 'university':
      return (
        <span className="block w-44 text-[15px] leading-5 font-medium text-fg">
          {card.university?.name ?? <Blank />}
        </span>
      );
    case 'direction':
      return card.it_direction ? (
        <span className="block w-36 text-fg">{card.it_direction.name}</span>
      ) : (
        <Blank />
      );
    case 'product':
      return card.it_product ? (
        <span className="block w-40">
          <span className="block truncate text-fg" title={card.it_product.name}>{card.it_product.name}</span>
          {card.it_product.vendor && (
            <span className="block text-desc text-fg-muted">{card.it_product.vendor.name}</span>
          )}
        </span>
      ) : (
        <Blank />
      );
    case 'stage': {
      const info = card.current_stage_id ? stages.get(card.current_stage_id) : undefined;
      return <StageChip info={info} fallback={card.transfer_status} className="w-52 max-w-52" />;
    }
    case 'responsible':
      return card.responsible_user ? (
        <span className="flex items-center gap-2.5 whitespace-nowrap">
          <Avatar name={card.responsible_user.full_name} size={36} />
          <span className="text-fg">{shortName(card.responsible_user.full_name)}</span>
        </span>
      ) : (
        <Blank>не назначен</Blank>
      );
    case 'contract':
      return card.contract_number ? (
        <span className="whitespace-nowrap text-fg">{card.contract_number}</span>
      ) : (
        <Blank />
      );
    case 'signed':
      return card.license_signed_at ? (
        <span className="text-fg">{formatDate(card.license_signed_at)}</span>
      ) : (
        <Blank />
      );
    case 'years':
      return card.license_years ? <span className="text-fg">{card.license_years}</span> : <Blank />;
    case 'expires':
      return <LicenseDate value={card.license_expires_at} showBadge />;
    case 'comment':
      return card.comment ? (
        <span className="line-clamp-2 min-w-48 text-fg-soft">{card.comment}</span>
      ) : (
        <Blank />
      );
    default:
      return <Blank />;
  }
}

function summarise(rows: InteractionRead[], stages: Map<string, StageInfo>) {
  const universities = new Set<string>();
  const responsibles = new Set<string>();
  let onRoute = 0;
  let finished = 0;
  let expiring = 0;
  let expired = 0;
  for (const card of rows) {
    universities.add(card.university_id);
    if (card.responsible_user_id) responsibles.add(card.responsible_user_id);
    const info = card.current_stage_id ? stages.get(card.current_stage_id) : undefined;
    if (info) {
      onRoute += 1;
      if (info.stage.is_final_success || info.index === info.total) finished += 1;
    }
    const state = licenseState(card.license_expires_at);
    if (state === 'soon') expiring += 1;
    if (state === 'expired') expired += 1;
  }
  return {
    universities: universities.size,
    responsibles: responsibles.size,
    onRoute,
    finished,
    expiring,
    expired,
  };
}

/*
 * Форматы выгрузки со знаком-глифом, как в «Замысле» системы: у каждого формата
 * свой мягкий тон, чтобы нужный находился глазами, а не чтением.
 */
const EXPORTS: {
  format: 'xls' | 'xlsx' | 'pdf' | 'csv' | 'json';
  label: string;
  hint: string;
  glyph: string;
}[] = [
  { format: 'xls', label: 'XLS', hint: 'Таблица для совместимости со старым Excel', glyph: 'bg-success-container text-success' },
  { format: 'xlsx', label: 'XLSX', hint: 'Таблица Excel с фильтрами', glyph: 'bg-success-container text-success' },
  { format: 'pdf', label: 'PDF', hint: 'Для печати и согласования', glyph: 'bg-accent-container text-accent' },
  { format: 'csv', label: 'CSV', hint: 'Для Excel на русской локали и 1С', glyph: 'bg-neutral-container text-fg' },
  { format: 'json', label: 'JSON', hint: 'Результирующий файл для интеграций', glyph: 'bg-s01-container text-s01 dark:text-s01-200' },
];

const PREVIEW_LIMIT = 50;
const UNASSIGNED = 'Не назначен';

function ExportButton({
  label,
  hint,
  glyph,
  onClick,
  busy,
  disabled,
}: {
  label: string;
  hint: string;
  glyph: string;
  onClick: () => void;
  busy: boolean;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border-0 bg-surface-3 p-3 text-left transition-[background-color,box-shadow,transform] duration-300 ease-productive hover:-translate-y-0.5 hover:bg-card hover:shadow-bottom-m active:scale-[.98] disabled:pointer-events-none disabled:opacity-50"
    >
      <span className={clsx('grid size-12 shrink-0 place-items-center rounded-l text-desc font-bold', glyph)}>
        {busy ? <Spinner className="size-5" /> : label}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body-m font-medium text-fg">Скачать {label}</span>
        <span className="block truncate text-body-s text-fg-muted">{hint}</span>
      </span>
      <Icon
        name="download"
        className="size-5 shrink-0 text-fg-muted transition-colors group-hover:text-accent"
      />
    </button>
  );
}

function toRow(card: InteractionRead, stages: Map<string, StageInfo>): Record<string, string> {
  const info = card.current_stage_id ? stages.get(card.current_stage_id) : undefined;
  return {
    university: card.university?.name ?? '',
    direction: card.it_direction?.name ?? '',
    product: card.it_product?.name ?? '',
    // The ТЗ's «статус работы с вузом» is the stage the card stands on; the free
    // text from the imported catalogue is the fallback for cards not on a route.
    stage: info?.stage.name ?? card.transfer_status ?? 'Не на маршруте',
    responsible: card.responsible_user ? shortName(card.responsible_user.full_name) : '',
    contract: card.contract_number ?? '',
    signed: card.license_signed_at ? formatDate(card.license_signed_at) : '',
    years: card.license_years ? String(card.license_years) : '',
    expires: card.license_expires_at ? formatDate(card.license_expires_at) : '',
    comment: card.comment ?? '',
  };
}

function describeFilters(values: Record<string, string>, count: number): string {
  const parts: string[] = [];
  if (values.signed_from || values.signed_to) {
    parts.push(
      `период подписания ${values.signed_from ? formatDate(values.signed_from) : '…'} — ${
        values.signed_to ? formatDate(values.signed_to) : '…'
      }`,
    );
  }
  if (values.university_id) parts.push('один вуз');
  if (values.it_direction_id) parts.push('одно направление');
  if (values.it_product_id) parts.push('один продукт');
  if (values.responsible_user_id) parts.push('один ответственный');

  const filters = parts.length > 0 ? parts.join(', ') : 'без ограничений';
  return `Отбор: ${filters}. Записей: ${count}. Сформирован ${formatDateLong(
    new Date().toISOString(),
  )}`;
}

function buildCharts(rows: InteractionRead[], stages: ReturnType<typeof useStageLookup>) {
  const byStage = new Map<string, number>();
  const byDirection = new Map<string, number>();
  const byResponsible = new Map<string, number>();

  for (const card of rows) {
    if (card.current_stage_id) {
      byStage.set(card.current_stage_id, (byStage.get(card.current_stage_id) ?? 0) + 1);
    }
    const direction = card.it_direction?.name ?? 'Без направления';
    byDirection.set(direction, (byDirection.get(direction) ?? 0) + 1);
    // The placeholder is a label, not a person's name, so it must not be
    // abbreviated into «Не н.» further down.
    const responsible = card.responsible_user?.full_name ?? UNASSIGNED;
    byResponsible.set(responsible, (byResponsible.get(responsible) ?? 0) + 1);
  }

  const stageData: Datum[] = stages.primary
    ? [...stages.primary.stages]
        .sort((a, b) => a.order_index - b.order_index)
        .map((stage) => ({
          key: stage.code ?? stage.name.slice(0, 6),
          name: stage.name,
          id: stage.id,
          value: byStage.get(stage.id) ?? 0,
        }))
    : [];

  const toData = (source: Map<string, number>, shorten = false): Datum[] =>
    [...source.entries()]
      .map(([name, value]) => ({
        key: name,
        name: shorten && name !== UNASSIGNED ? shortName(name) : name,
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

  return {
    stages: stageData.some((item) => item.value > 0) ? stageData : [],
    directions: toData(byDirection),
    responsibles: toData(byResponsible, true),
  };
}
