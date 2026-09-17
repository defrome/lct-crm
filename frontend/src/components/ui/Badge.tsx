import clsx from 'clsx';
import type { ReactNode } from 'react';

/*
 * Badge — по «Атомаро»: высота s (24), скругление xs (4), description-l-strong.
 *
 * Этапы и статусы данных — палитры status-01 и status-02. Оранжевый акцент
 * (`accent`) — только для «горячего», требующего действия. Состояния успеха,
 * предупреждения и ошибки повторяют рисунок системного `success`: мягкий фон,
 * основной цвет текста и цветная точка — так статус читается не одним цветом.
 */
export type Tone =
  | 'neutral'
  | 'accent'
  | 'accent2'
  | 's01'
  | 's02'
  | 'success'
  | 'warning'
  | 'error'
  | 'info';

const TONES: Record<Tone, string> = {
  neutral: 'bg-neutral-container text-fg-soft',
  accent: 'bg-accent text-white',
  accent2: 'bg-accent-container text-accent-active dark:text-accent-300',
  s01: 'bg-s01-container text-s01 dark:text-s01-200',
  s02: 'bg-s02-container text-s02 dark:text-s02-200',
  success: 'bg-success-container text-fg',
  warning: 'bg-warning-container text-fg',
  error: 'bg-error-container text-fg',
  info: 'bg-info-container text-fg',
};

const DOT: Partial<Record<Tone, string>> = {
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
  info: 'bg-info',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={clsx(
        'tnum inline-flex h-6 max-w-full shrink-0 items-center gap-1 rounded-xs px-2 text-desc font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {DOT[tone] && (
        <span aria-hidden="true" className={clsx('size-1.5 shrink-0 rounded-full', DOT[tone])} />
      )}
      <span className="inline-flex min-w-0 items-center gap-1 truncate [&>svg]:shrink-0">{children}</span>
    </span>
  );
}

/** Небольшая точка-индикатор в плотных строках, где бейдж слишком громкий. */
export function Dot({ tone = 'neutral', className }: { tone?: Tone; className?: string }) {
  const color: Record<Tone, string> = {
    neutral: 'bg-fg-muted',
    accent: 'bg-accent',
    accent2: 'bg-accent-muted',
    s01: 'bg-s01',
    s02: 'bg-s02',
    success: 'bg-success',
    warning: 'bg-warning',
    error: 'bg-error',
    info: 'bg-info',
  };
  return <span className={clsx('inline-block size-1.5 shrink-0 rounded-full', color[tone], className)} />;
}

/**
 * Аватар: инициалы на мягких тонах палитры. Тон выбирается по имени, чтобы один
 * человек всегда выглядел одинаково; точка — «в сети».
 */
const AVATAR_TONES = [
  'bg-s01-100',
  'bg-accent-100',
  'bg-neutral-50',
  'bg-[linear-gradient(135deg,var(--atmr-status-01-100),var(--atmr-accent-100))]',
];

export function Avatar({
  name,
  size = 40,
  online,
  className,
}: {
  name: string;
  size?: 36 | 40 | 48;
  online?: boolean;
  className?: string;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const tone = AVATAR_TONES[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 4];

  return (
    <span
      title={name}
      className={clsx(
        'relative grid shrink-0 place-items-center rounded-full font-medium text-neutral-990',
        size === 36 ? 'size-9 text-desc' : size === 40 ? 'size-10 text-body-s' : 'size-12 text-body-s',
        tone,
        className,
      )}
    >
      {initials || '?'}
      {online && (
        <span
          aria-hidden="true"
          className="absolute right-0 bottom-px size-2.5 rounded-full bg-success shadow-[0_0_0_2px_var(--atmr-bg-surface1)]"
        />
      )}
    </span>
  );
}

/** Progress — дорожка 12px капсулой; заполнение растёт по expressive-entrance. */
export function Progress({
  value,
  tone = 'accent',
  className,
  label,
}: {
  /** 0…1 */
  value: number;
  tone?: 'accent' | 'past' | 'now';
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
      className={clsx('h-3 overflow-hidden rounded-full bg-neutral-container', className)}
    >
      <span
        className={clsx(
          'animate-grow-x block h-full rounded-full',
          tone === 'accent' ? 'bg-accent' : tone === 'past' ? 'bg-chart-past' : 'bg-chart-now',
        )}
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%` }}
      />
    </div>
  );
}
