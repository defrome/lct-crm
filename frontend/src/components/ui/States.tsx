import clsx from 'clsx';
import type { ReactNode } from 'react';

import { Link } from 'react-router-dom';

import { ApiError } from '@/api/client';
import { Button, buttonClass } from './Button';
import { Icon, type IconName } from './Icon';

/*
 * Пустое состояние CRM: блок surface3 со скруглением xl, знак 48px на
 * accent-container, заголовок heading-h4, пояснение body-s и следующий шаг.
 */
export function EmptyState({
  icon = 'search',
  title,
  message,
  action,
  compact,
  tone = 'accent',
}: {
  icon?: IconName;
  title: string;
  message?: string;
  action?: ReactNode;
  compact?: boolean;
  tone?: 'accent' | 'error' | 'success';
}) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center gap-2 rounded-xl bg-surface-3 text-center',
        compact ? 'px-4 py-6' : 'px-6 py-10',
      )}
    >
      <span
        className={clsx(
          'grid size-12 place-items-center rounded-l',
          tone === 'accent' && 'bg-accent-container text-accent',
          tone === 'error' && 'bg-error-container text-error',
          tone === 'success' && 'bg-success-container text-success',
        )}
      >
        <Icon name={icon} className="size-6" />
      </span>
      <p className="mt-1 text-h4 font-bold text-fg">{title}</p>
      {message && <p className="max-w-[36ch] text-body-s text-fg-muted">{message}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/** Объясняет, что случилось и что делать, — не просто «ошибка». */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const apiError = error instanceof ApiError ? error : null;
  const title = apiError?.isAccessDenied
    ? 'Нет доступа к этим данным'
    : apiError?.isNotFound
      ? 'Запись не найдена'
      : apiError?.status === 0
        ? 'Сервер недоступен'
        : 'Не удалось загрузить данные';

  const message = apiError?.isAccessDenied
    ? 'Ваша роль не позволяет открыть этот раздел. Обратитесь к руководителю или администратору.'
    : apiError?.isNotFound
      ? 'Возможно, её удалили или ссылка устарела.'
      : (apiError?.message ?? (error as Error)?.message);

  return (
    <EmptyState
      icon="alert"
      tone="error"
      title={title}
      message={
        message && apiError?.requestId
          ? `${message} Запрос ${apiError.requestId.slice(0, 8)}.`
          : message
      }
      action={
        onRetry &&
        !apiError?.isAccessDenied && (
          <Button size="m" variant="primary" icon="refresh" onClick={onRetry}>
            Повторить
          </Button>
        )
      }
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('skeleton', className)} />;
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-2 py-3">
          {Array.from({ length: columns }, (_, columnIndex) => (
            <Skeleton
              key={columnIndex}
              className={clsx('h-4 rounded-full', columnIndex === 0 ? 'w-[28%]' : 'flex-1')}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Заголовок экрана — как приветствие на дашборде системы: Display с плавной
 * подстройкой слева, инструменты экрана справа.
 */
export function PageHeader({
  eyebrow,
  back,
  title,
  meta,
  actions,
  className,
}: {
  eyebrow?: string;
  /** Возврат к списку — ghost-кнопка над заголовком. */
  back?: { to: string; label: string };
  title: ReactNode;
  /** Короткий фактический контекст — счётчики, период, владелец. */
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={clsx(
        'mt-6 mb-5 flex min-w-0 flex-wrap items-center justify-between gap-4 lg:mt-14 lg:mb-8',
        className,
      )}
    >
      <div className="min-w-0 max-w-full flex-1 basis-full sm:basis-auto">
        {back && (
          <Link
            to={back.to}
            className={buttonClass({ variant: 'ghost', size: 'm', className: '-ml-3 mb-3' })}
          >
            <Icon name="arrowLeft" className="size-4" />
            <span className="px-1">{back.label}</span>
          </Link>
        )}
        {eyebrow && <p className="cap mb-2">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        {meta && <div className="mt-3 text-body-m text-fg-muted">{meta}</div>}
      </div>
      {actions && <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/**
 * Заголовок карточки — card-h из системы: heading-h2, подзаголовок body-s,
 * справа иконки-кнопки действий.
 */
export function CardHeader({
  title,
  sub,
  actions,
  className,
}: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="card-title">{title}</h2>
        {sub && <div className="card-sub mt-1.5">{sub}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Подпись и значение внутри карточки. */
export function DataRow({
  label,
  children,
  mono,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 py-3 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="shrink-0 text-body-s text-fg-muted sm:w-40">{label}</dt>
      <dd className={clsx('min-w-0 flex-1 text-body-m text-fg', mono && 'tnum')}>{children}</dd>
    </div>
  );
}

/** Заглушка для отсутствующего значения — вместо пустой ячейки. */
export function Blank({ children = '—' }: { children?: ReactNode }) {
  return <span className="text-fg-muted">{children}</span>;
}
