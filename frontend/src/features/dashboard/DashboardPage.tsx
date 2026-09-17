import { useQuery } from '@tanstack/react-query';
import { useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

import { interactionsApi } from '@/api/endpoints';
import { useUniversities } from '@/api/queries';
import type { InteractionRead } from '@/api/types';
import { useAuth } from '@/app/AuthProvider';
import { CategoryBars, ChartCard, SequenceBars, StatTile, type Datum } from '@/components/charts/Charts';
import { Page } from '@/components/layout/AppShell';
import { Avatar, Badge, Progress } from '@/components/ui/Badge';
import { Button, ChipStatic, IconButton } from '@/components/ui/Button';
import { CardHeader, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/States';
import { useStageLookup, type StageInfo } from '@/features/workflows/useStageLookup';
import { exportChartPng } from '@/lib/exportChart';
import { fetchAll } from '@/lib/fetchAll';
import { daysUntil, formatDate, licenseState, shortName } from '@/lib/format';

/** Лицензия ближе этого срока требует действия. */
const EXPIRY_HORIZON_DAYS = 90;

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const stages = useStageLookup();
  const universities = useUniversities({ size: 1 });
  const pipelineRef = useRef<HTMLDivElement>(null);

  // Дашборд агрегирует, а не листает, — нужен весь набор, который пользователю
  // разрешено видеть; область по роли ограничивает сам API.
  const all = useQuery({
    queryKey: ['interactions', 'all'],
    queryFn: () => fetchAll(interactionsApi.list, {}),
    staleTime: 60_000,
  });

  const cards = useMemo(() => all.data?.items ?? [], [all.data]);
  const stats = useMemo(() => summarise(cards, stages.byStageId), [cards, stages.byStageId]);

  const stageData = useMemo<Datum[]>(() => {
    const graph = stages.primary;
    if (!graph) return [];
    return [...graph.stages]
      .sort((a, b) => a.order_index - b.order_index)
      .map((stage) => ({
        key: stage.code ?? stage.name.slice(0, 6),
        name: stage.name,
        id: stage.id,
        value: stats.byStage.get(stage.id) ?? 0,
      }));
  }, [stages.primary, stats.byStage]);

  const top = (source: Map<string, number>, shorten = false): Datum[] =>
    [...source.entries()]
      .map(([name, value]) => ({ key: name, name: shorten ? shortName(name) : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);

  if (all.error) {
    return (
      <Page>
        <ErrorState error={all.error} onRetry={() => void all.refetch()} />
      </Page>
    );
  }

  const loading = all.isPending || stages.isLoading;
  const firstName = user ? (user.full_name.split(/\s+/)[1] ?? user.full_name) : '';
  const peak = stageData.reduce<Datum | null>(
    (best, datum) => (!best || datum.value > best.value ? datum : best),
    null,
  );
  const emptyStages = stageData.filter((datum) => datum.value === 0).length;
  const withLicense = stats.withLicense || 1;

  return (
    <Page>
      <PageHeader
        title={`Здравствуйте, ${firstName}`}
        actions={
          <>
            <IconButton
              icon="search"
              label="Найти карточку"
              variant="onCard"
              onClick={() => navigate('/interactions')}
            />
            <Button
              variant="outline"
              icon="report"
              className="bg-card"
              onClick={() => navigate('/reports')}
            >
              Собрать отчёт
            </Button>
          </>
        }
      />

      {loading ? (
        <DashboardSkeleton />
      ) : cards.length === 0 ? (
        <div className="card card-pad">
          <EmptyState
            icon="cards"
            title="Данных для сводки пока нет"
            message="Загрузите каталог из Excel или заведите первую карточку взаимодействия."
            action={
              <Button variant="primary" icon="import" onClick={() => navigate('/imports/new')}>
                Загрузить каталог
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid gap-3 lg:gap-4 xl:grid-cols-[.92fr_1.6fr_1.1fr]">
          <StatTile
            label="Карточки в работе"
            value={stats.total}
            hint={
              <>
                {stats.onRoute} на маршруте
                <br />
                {universities.data?.total ?? '—'} вузов в справочнике
              </>
            }
            onClick={() => navigate('/interactions')}
          />

          <RecentCard
            cards={cards}
            stages={stages.byStageId}
            onOpen={() => navigate('/interactions')}
            onRow={(id) => navigate(`/interactions/${id}`)}
          />

          <article className="card card-pad flex flex-col">
            <CardHeader
              title="Лицензии"
              actions={
                <IconButton
                  icon="go"
                  label="Открыть отчёт по лицензиям"
                  size="m"
                  go
                  onClick={() => navigate('/reports?columns=university,product,expires,responsible')}
                />
              }
            />
            <div className="mt-6">
              <p className="cap">Истекают в {EXPIRY_HORIZON_DAYS} дней</p>
              <div className="mt-1.5 mb-3.5 flex items-end justify-between gap-3">
                <span className="money">{stats.expiringSoon.length}</span>
                <span className="tnum text-right text-desc text-fg-muted">
                  С лицензией
                  <br />
                  <b className="font-medium text-fg">{stats.withLicense}</b> карточек
                </span>
              </div>
              <Progress
                value={stats.expiringSoon.length / withLicense}
                tone="accent"
                label="Доля истекающих лицензий"
              />
            </div>
            <div className="mt-7">
              <p className="cap">Истекли</p>
              <div className="mt-1.5 mb-3.5 flex items-end justify-between gap-3">
                <span className="money">{stats.expired.length}</span>
                <span className="text-right text-desc text-fg-muted">
                  {stats.expired.length > 0 ? 'требуют продления' : 'просроченных нет'}
                </span>
              </div>
              <Progress
                value={stats.expired.length / withLicense}
                tone="past"
                label="Доля истёкших лицензий"
              />
            </div>
            {stats.attention.length > 0 && (
              <ul className="mt-6 flex flex-col gap-1">
                {stats.attention.slice(0, 3).map((card) => (
                  <li key={card.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/interactions/${card.id}`)}
                      className="-mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-center justify-between gap-3 rounded-l border-0 bg-transparent px-2 py-2 text-left transition-colors hover:bg-surface-3"
                    >
                      <span className="min-w-0 truncate text-body-s text-fg">
                        {card.university?.short_name ?? card.university?.name}
                      </span>
                      <Badge tone={licenseState(card.license_expires_at) === 'expired' ? 'error' : 'warning'}>
                        {formatDate(card.license_expires_at)}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </article>

          {/* «Сравнение»: сведения слева, блочный график в центре, фиолетовая панель справа. */}
          <article className="card grid overflow-hidden xl:col-span-3 lg:grid-cols-[minmax(220px,280px)_1fr_80px]">
            <div className="flex flex-col p-5 sm:p-7">
              <h2 className="card-title">Где сейчас работа</h2>
              <p className="cap mt-9">На маршруте: {stats.onRoute}</p>
              <p className="mt-2.5 mb-2.5 text-display-l font-medium tracking-[-0.01em] text-fg">
                {peak?.value ? peak.key : '—'}
              </p>
              <p className="text-body-s text-fg-muted">
                {peak?.value
                  ? `Больше всего карточек: ${peak.name.toLowerCase()}`
                  : 'Карточки ещё не поставлены на маршрут'}
              </p>
              <div className="mt-auto flex flex-wrap items-start gap-2 pt-6 lg:flex-col">
                <ChipStatic className="tnum">{emptyStages} этапов без карточек</ChipStatic>
                <ChipStatic className="max-w-full" title={stages.primary?.workflow.name}>
                  <span className="truncate">
                    {stages.primary?.workflow.name ?? 'Процесс не настроен'}
                  </span>
                </ChipStatic>
              </div>
            </div>

            <div ref={pipelineRef} className="min-w-0 px-5 pb-5 sm:px-7 lg:px-0 lg:py-7">
              {stageData.length > 0 ? (
                <SequenceBars
                  data={stageData}
                  height={300}
                  onSelect={() => navigate('/interactions')}
                />
              ) : (
                <EmptyState
                  compact
                  icon="route"
                  title="Процесс не настроен"
                  message="Опубликуйте версию workflow, чтобы видеть распределение карточек."
                />
              )}
            </div>

            <div className="flex items-center justify-end gap-2.5 bg-panel px-4 py-3 lg:flex-col lg:justify-start lg:px-0 lg:py-7">
              <IconButton
                icon="go"
                label="Открыть процесс"
                variant="onCard"
                go
                onClick={() => navigate('/workflows')}
              />
              <IconButton
                icon="download"
                label="Скачать диаграмму в PNG"
                variant="onCard"
                onClick={() =>
                  pipelineRef.current &&
                  void exportChartPng(pipelineRef.current, 'Карточки по этапам')
                }
              />
              <IconButton
                icon="filter"
                label="Отбор в отчёте"
                variant="onCard"
                onClick={() => navigate('/reports')}
              />
            </div>
          </article>

          <div className="grid gap-3 lg:gap-4 md:grid-cols-2 xl:col-span-3 xl:grid-cols-3">
          <ChartCard
            title="По ИТ-направлениям"
            hint="Сколько связок в каждом направлении"
            onOpen={() => navigate('/catalogs/directions')}
            openLabel="Справочник направлений"
          >
            <CategoryBars
              data={top(stats.byDirection)}
              onSelect={(datum) => navigate(`/interactions?q=${encodeURIComponent(datum.name)}`)}
              emptyLabel="Ни у одной карточки не задано направление"
            />
          </ChartCard>

          <ChartCard
            title="По ИТ-продуктам"
            hint="Самые частые продукты"
            onOpen={() => navigate('/catalogs/products')}
            openLabel="Справочник продуктов"
          >
            <CategoryBars
              data={top(stats.byProduct)}
              onSelect={(datum) => navigate(`/interactions?q=${encodeURIComponent(datum.name)}`)}
              emptyLabel="Ни у одной карточки не задан продукт"
            />
          </ChartCard>

          <ChartCard
            title="Нагрузка по КАМам"
            hint="Карточек на ответственного"
            onOpen={() => navigate('/users')}
            openLabel="Сотрудники"
          >
            <CategoryBars
              data={top(stats.byResponsible, true)}
              emptyLabel="Ответственные ещё не назначены"
            />
          </ChartCard>
          </div>
        </div>
      )}

      {all.data?.truncated && (
        <p className="mt-3 text-body-s text-fg-muted">
          Сводка построена по первым 10 000 карточкам — для полного среза используйте отчёт.
        </p>
      )}
    </Page>
  );
}

/** «Выигранные сделки» в терминах CRM ИТ Школы: последние изменённые карточки. */
function RecentCard({
  cards,
  stages,
  onOpen,
  onRow,
}: {
  cards: InteractionRead[];
  stages: Map<string, StageInfo>;
  onOpen: () => void;
  onRow: (id: string) => void;
}) {
  const recent = [...cards].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 5);

  return (
    <article className="card card-pad min-w-0">
      <CardHeader
        title="Недавние карточки"
        sub="Что менялось последним"
        actions={<IconButton icon="go" label="Все взаимодействия" size="m" go onClick={onOpen} />}
      />
      <div className="-mx-2 mt-5 overflow-x-auto">
        <table className="tnum w-full table-fixed border-separate border-spacing-0 text-body-s">
          <colgroup>
            <col />
            <col className="w-[88px]" />
            <col className="w-[84px]" />
          </colgroup>
          <thead>
            <tr>
              {['Вуз', 'Обновлена', 'Этап'].map((header) => (
                <th key={header} className="label px-2 pb-2.5 text-left font-normal">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recent.map((card) => {
              const info = card.current_stage_id ? stages.get(card.current_stage_id) : undefined;
              const name = card.university?.short_name ?? card.university?.name ?? 'Вуз';
              return (
                <tr
                  key={card.id}
                  tabIndex={0}
                  onClick={() => onRow(card.id)}
                  onKeyDown={(event) => event.key === 'Enter' && onRow(card.id)}
                  className="group/row cursor-pointer"
                >
                  <td className="rounded-l-l px-2 py-2 transition-colors duration-150 group-hover/row:bg-surface-3">
                    <span className="flex min-w-0 items-center gap-3">
                      <Avatar name={name} size={36} />
                      <span className="min-w-0">
                        <b className="block truncate text-[15px] leading-5 font-medium text-fg">
                          {name}
                        </b>
                        <span className="block truncate text-desc text-fg-muted">
                          {card.it_product?.name ?? card.it_direction?.name ?? 'Без продукта'}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap transition-colors duration-150 group-hover/row:bg-surface-3">
                    {formatDate(card.updated_at).slice(0, 5)}
                  </td>
                  <td className="rounded-r-l px-2 py-2 transition-colors duration-150 group-hover/row:bg-surface-3">
                    {info ? (
                      <Badge tone={info.stage.is_final_success ? 'success' : 's01'}>
                        {info.stage.code ?? `${info.index}/${info.total}`}
                      </Badge>
                    ) : (
                      <Badge>вне маршрута</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-3 lg:gap-4 xl:grid-cols-[.92fr_1.6fr_1.1fr]">
      <Skeleton className="h-72 rounded-card" />
      <Skeleton className="h-72 rounded-card" />
      <Skeleton className="h-72 rounded-card" />
      <Skeleton className="h-96 rounded-card xl:col-span-3" />
    </div>
  );
}

/** Один проход по карточкам даёт все числа экрана. */
function summarise(cards: InteractionRead[], stageInfo: Map<string, unknown>) {
  const byStage = new Map<string, number>();
  const byDirection = new Map<string, number>();
  const byProduct = new Map<string, number>();
  const byResponsible = new Map<string, number>();
  const expired: InteractionRead[] = [];
  const expiringSoon: InteractionRead[] = [];

  let onRoute = 0;
  let withLicense = 0;

  for (const card of cards) {
    if (card.current_stage_id) {
      byStage.set(card.current_stage_id, (byStage.get(card.current_stage_id) ?? 0) + 1);
      if (stageInfo.has(card.current_stage_id)) onRoute += 1;
    }
    if (card.it_direction?.name) {
      byDirection.set(card.it_direction.name, (byDirection.get(card.it_direction.name) ?? 0) + 1);
    }
    if (card.it_product?.name) {
      byProduct.set(card.it_product.name, (byProduct.get(card.it_product.name) ?? 0) + 1);
    }
    if (card.responsible_user?.full_name) {
      const name = card.responsible_user.full_name;
      byResponsible.set(name, (byResponsible.get(name) ?? 0) + 1);
    }

    const state = licenseState(card.license_expires_at);
    if (state !== 'none') withLicense += 1;
    if (state === 'expired') expired.push(card);
    else if (state === 'soon') expiringSoon.push(card);
  }

  // Сначала истёкшие, затем ближайшие к истечению — в порядке, в котором их разбирают.
  const attention = [...expired, ...expiringSoon].sort(
    (a, b) => daysUntil(a.license_expires_at!) - daysUntil(b.license_expires_at!),
  );

  return {
    total: cards.length,
    onRoute,
    withLicense,
    byStage,
    byDirection,
    byProduct,
    byResponsible,
    expired,
    expiringSoon,
    attention,
  };
}
