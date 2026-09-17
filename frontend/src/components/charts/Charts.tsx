import clsx from 'clsx';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { Progress } from '@/components/ui/Badge';
import { IconButton } from '@/components/ui/Button';
import { CardHeader } from '@/components/ui/States';
import { plural } from '@/components/ui/DataTable';
import { exportChartPng } from '@/lib/exportChart';
import { formatNumber } from '@/lib/format';

export interface Datum {
  /** Короткая подпись на оси — код этапа, название направления. */
  key: string;
  /** Полная подпись для подсказки. */
  name: string;
  value: number;
  /** Возвращается при клике — чтобы график мог отфильтровать список. */
  id?: string;
}

/**
 * Карточка графика — card-h из системы: заголовок heading-h2 и подзаголовок,
 * справа иконки-кнопки «скачать PNG» (FR-02) и «перейти».
 */
export function ChartCard({
  title,
  hint,
  exportName,
  onOpen,
  openLabel = 'Открыть',
  children,
  action,
  className,
}: {
  title: string;
  hint?: ReactNode;
  exportName?: string;
  onOpen?: () => void;
  openLabel?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  return (
    <section className={clsx('card card-pad flex flex-col', className)} aria-labelledby={titleId}>
      <CardHeader
        title={<span id={titleId}>{title}</span>}
        sub={hint}
        actions={
          <>
            {action}
            {exportName && (
              <IconButton
                icon="download"
                label="Скачать диаграмму в PNG"
                size="m"
                onClick={() => ref.current && void exportChartPng(ref.current, exportName)}
              />
            )}
            {onOpen && <IconButton icon="go" label={openLabel} size="m" go onClick={onOpen} />}
          </>
        }
      />
      <div ref={ref} className="mt-5 min-w-0 flex-1">
        {children}
      </div>
    </section>
  );
}

/**
 * Количество по упорядоченной последовательности — 14 этапов маршрута.
 *
 * Столбцы-блоки со скруглением block (12px) цвета chart-now стоят на оси
 * маршрута; над активным столбцом — плашка neutral-990 со значением, как в
 * «Сравнении выигранных». Рост при загрузке — expressive-entrance волной с шагом
 * 55 мс. Рисуется в SVG, чтобы диаграмму можно было выгрузить в PNG.
 */
export function SequenceBars({
  data,
  height = 240,
  onSelect,
}: {
  data: Datum[];
  height?: number;
  onSelect?: (datum: Datum) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const LABEL = 28;
  const TIP = 52;
  const gap = 8;
  const count = Math.max(1, data.length);
  const column = width > 0 ? (width - gap * (count - 1)) / count : 0;
  const barWidth = Math.min(column, 44);
  const plot = height - LABEL - TIP;
  const max = Math.max(1, ...data.map((datum) => datum.value));
  // Без наведения подсвечен самый загруженный этап — ответ на вопрос карточки.
  const peak = data.reduce((best, datum, index) => (datum.value > data[best].value ? index : best), 0);
  const shown = active ?? peak;
  // Подсветка пика — фон карточки без наведения; сама расшифровка — только по наведению.
  const hovered = active !== null;
  const compact = column < 44;

  return (
    <div
      ref={wrapRef}
      className="relative w-full select-none"
      style={{ height }}
      onMouseLeave={() => setActive(null)}
    >
      {width > 0 && (
        <svg
          width={width}
          height={height}
          className="block overflow-visible"
          role="img"
          aria-label="Количество карточек по этапам"
        >
          {data.map((datum, index) => {
            const left = index * (column + gap);
            const x = left + (column - barWidth) / 2;
            const barHeight =
              datum.value === 0 ? 8 : Math.max(20, (datum.value / max) * (plot - 8));
            const y = TIP + plot - barHeight;
            const isActive = index === shown;
            return (
              <g
                key={datum.key}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                onClick={() => onSelect?.(datum)}
                tabIndex={0}
                role="button"
                aria-label={`${datum.key} — ${datum.name}: ${datum.value}`}
                className={clsx('outline-none', onSelect && 'cursor-pointer')}
              >
                <rect x={left} y={0} width={column} height={height} fill="transparent" />
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx={Math.min(12, barWidth / 2)}
                  fill={
                    datum.value === 0
                      ? 'var(--atmr-neutral-container-default)'
                      : 'var(--crm-chart-now)'
                  }
                  className="animate-grow-y"
                  style={{
                    transformBox: 'fill-box',
                    animationDelay: `${index * 55}ms`,
                    filter:
                      isActive && datum.value > 0 ? 'saturate(1.2) brightness(1.03)' : undefined,
                  }}
                />
                {datum.value > 0 && (
                  // На экране значение показывает плашка над столбцом; в PNG стилей
                  // нет, поэтому эта подпись, скрытая классом, в файле становится видна.
                  <text
                    x={left + column / 2}
                    y={y - 8}
                    textAnchor="middle"
                    fontSize={14}
                    fontWeight={500}
                    fill="var(--atmr-fg-default)"
                    fontFamily="var(--atmr-font-family-base)"
                    className="opacity-0"
                    aria-hidden="true"
                  >
                    {datum.value}
                  </text>
                )}
                <text
                  x={left + column / 2}
                  y={height - 6}
                  textAnchor="middle"
                  fontSize={compact ? 12 : 14}
                  fontWeight={isActive ? 500 : 400}
                  fill={isActive ? 'var(--atmr-fg-default)' : 'var(--atmr-fg-muted)'}
                  fontFamily="var(--atmr-font-family-base)"
                >
                  {compact ? datum.key.replace(/^[A-ZА-Я]+-0?/, '') : datum.key}
                </text>
              </g>
            );
          })}
        </svg>
      )}

      {width > 0 && data[shown] && (
        <div
          className={clsx(
            'pointer-events-none absolute top-0 flex max-w-64 -translate-x-1/2 flex-col items-center gap-0.5 rounded-m bg-inverse/85 px-3.5 py-2 text-center text-on-inverse backdrop-blur-sm',
            'transition-[left,opacity,transform] duration-200 ease-productive-out',
            // Расшифровка — только результат наведения, не постоянная деталь экрана:
            // без этого она перекрывала бы соседние столбцы и болталась на месте пика,
            // пока никто ни на что не навёл.
            hovered
              ? 'opacity-100 delay-100 ease-productive-in'
              : 'translate-y-1 opacity-0',
          )}
          style={{
            left: Math.min(
              Math.max(shown * (column + gap) + column / 2, 130),
              Math.max(130, width - 130),
            ),
          }}
        >
          <span className="tnum text-body-m font-medium whitespace-nowrap">
            {formatNumber(data[shown].value)}{' '}
            {plural(data[shown].value, ['карточка', 'карточки', 'карточек'])}
          </span>
          {/* Код без названия ничего не говорит вне контекста, поэтому подсказка
              несёт оба: и код этапа, и его расшифровку из workflow. */}
          <span className="text-desc leading-snug opacity-80">
            {data[shown].key} · {data[shown].name}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Количество по категориям с названиями словами — направления, продукты, люди.
 * Как блок «Продажи»: подпись и значение в строку, под ними полоса 12px.
 */
export function CategoryBars({
  data,
  onSelect,
  tone = 'past',
  emptyLabel = 'Нет данных за выбранный отбор',
}: {
  data: Datum[];
  onSelect?: (datum: Datum) => void;
  /** Цвет полос: chart-past (фиолетовый) или chart-now (персиковый) — разводит соседние графики. */
  tone?: 'past' | 'now';
  emptyLabel?: string;
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-body-s text-fg-muted">{emptyLabel}</p>;
  }

  const max = Math.max(...data.map((datum) => datum.value), 1);

  return (
    <ul className="flex flex-col gap-4">
      {data.map((datum) => {
        const content = (
          <>
            <span className="mb-2 flex items-baseline justify-between gap-3">
              <span className="truncate text-body-s text-fg" title={datum.name}>
                {datum.name}
              </span>
              <span className="tnum text-body-m font-medium text-fg">{datum.value}</span>
            </span>
            <Progress value={datum.value / max} tone={tone} label={datum.name} />
          </>
        );
        return (
          <li key={datum.key}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(datum)}
                className="group block w-full cursor-pointer rounded-m border-0 bg-transparent p-0 text-left [&:hover_.text-fg-soft]:text-fg"
              >
                {content}
              </button>
            ) : (
              <div>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Карточка метрики — «Новые лиды»: заголовок, стрелка перехода и крупная цифра
 * (единственное типографическое расширение системы) с подписью рядом.
 */
export function StatTile({
  label,
  value,
  hint,
  tone = 'neutral',
  onClick,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'neutral' | 'warning' | 'error' | 'success';
  onClick?: () => void;
}) {
  return (
    <article className="card card-pad flex min-w-0 flex-col">
      <CardHeader
        title={label}
        actions={
          onClick && (
            <IconButton icon="go" label={`Открыть: ${label}`} size="m" go onClick={onClick} />
          )
        }
      />
      <div className="mt-5 flex flex-wrap items-end gap-x-3 gap-y-1">
        <span className="metric">{value}</span>
        {hint && (
          <small className="pb-2 text-body-s text-fg-muted">
            {tone !== 'neutral' && (
              <span
                aria-hidden="true"
                className={clsx(
                  'mr-1.5 inline-block size-2 rounded-full align-middle',
                  tone === 'warning' && 'bg-warning',
                  tone === 'error' && 'bg-error',
                  tone === 'success' && 'bg-success',
                )}
              />
            )}
            {hint}
          </small>
        )}
      </div>
    </article>
  );
}
