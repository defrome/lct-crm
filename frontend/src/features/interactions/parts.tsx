import clsx from 'clsx';

import type { InteractionRead } from '@/api/types';
import { Avatar, Badge, type Tone } from '@/components/ui/Badge';
import { Blank } from '@/components/ui/States';
import { daysUntil, formatDate, licenseState, shortName } from '@/lib/format';
import type { StageInfo } from '@/features/workflows/useStageLookup';

/**
 * Где стоит карточка — ответ на вопрос «что с вузом сейчас». Код этапа — бейдж
 * status-01, как этапы сделки в системе; успешный финал — success.
 */
export function StageChip({
  info,
  fallback,
  className,
}: {
  info?: StageInfo;
  /** Текстовый статус из каталога — пока карточка не на маршруте. */
  fallback?: string | null;
  className?: string;
}) {
  if (info) {
    return (
      <span className={clsx('inline-flex min-w-0 items-center gap-2', className)}>
        <Badge tone={info.stage.is_final_success ? 'success' : 's01'}>
          {info.stage.code ?? `${info.index}/${info.total}`}
        </Badge>
        <span className="truncate text-body-s text-fg" title={info.stage.name}>{info.stage.name}</span>
      </span>
    );
  }

  if (fallback) {
    return (
      <Badge tone="s02" className={className}>
        {fallback}
      </Badge>
    );
  }

  return (
    <Badge tone="neutral" className={className}>
      вне маршрута
    </Badge>
  );
}

const LICENSE_TONE: Record<string, Tone> = {
  expired: 'error',
  soon: 'warning',
  active: 'success',
};

/** Дата лицензии, которая сразу говорит, насколько срочно. */
export function LicenseDate({ value, showBadge }: { value: string | null; showBadge?: boolean }) {
  const state = licenseState(value);
  if (state === 'none' || !value) return <Blank />;

  const days = daysUntil(value);
  const label =
    state === 'expired'
      ? `истекла ${formatDate(value)}`
      : state === 'soon'
        ? `${formatDate(value)} · ${days} дн.`
        : formatDate(value);

  // Срочное всегда бейджем: цвет, точка и слово — статус не читается одним цветом.
  if (showBadge || state !== 'active') {
    return <Badge tone={LICENSE_TONE[state]}>{label}</Badge>;
  }

  return <span className="tnum text-body-s text-fg">{label}</span>;
}

/** Строка карточки: вуз, под ним направление и продукт — как «человек» в таблице системы. */
export function InteractionSubject({ row, avatar }: { row: InteractionRead; avatar?: boolean }) {
  const name = row.university?.short_name ?? row.university?.name ?? 'Вуз не указан';
  return (
    <span className="flex min-w-0 items-center gap-3">
      {avatar && <Avatar name={name} size={36} />}
      <span className="flex min-w-0 flex-col">
        <b className="truncate text-[15px] leading-5 font-medium text-fg">{name}</b>
        <span className="truncate text-desc text-fg-muted">
          {[row.it_direction?.name, row.it_product?.name].filter(Boolean).join(' · ') ||
            'Направление и продукт не заданы'}
        </span>
      </span>
    </span>
  );
}

export function ResponsibleCell({ row }: { row: InteractionRead }) {
  if (!row.responsible_user) return <Blank>не назначен</Blank>;
  return <span className="text-body-s text-fg">{shortName(row.responsible_user.full_name)}</span>;
}
