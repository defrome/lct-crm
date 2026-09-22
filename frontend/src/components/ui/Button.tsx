// oxlint-disable react/only-export-components
import clsx from 'clsx';
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

import { Icon, type IconName } from './Icon';

/*
 * Button, IconButton, Chip — по «Атомаро».
 *
 * Button: variant primary | secondary | outline | ghost, colorScheme accent |
 * neutral, size s 24 | m 36 | l 48 | xl 56. Скругление buttons (8px), подпись
 * body-s-strong (s — description-l-strong, l/xl — body-m-strong). Нажатие —
 * accent-active и сжатие до 97% за duration-2xs.
 *
 * Оранжевый акцент — только для действий: главная кнопка экрана, выбранный
 * чип, переключатель. Всё остальное — нейтральная схема.
 */

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Scheme = 'accent' | 'neutral';
type Size = 's' | 'm' | 'l' | 'xl';

const BASE =
  'inline-flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-m border-0 ' +
  'transition-[background-color,box-shadow,transform,color] duration-150 ease-productive ' +
  'active:scale-[.97] active:duration-100 disabled:pointer-events-none ' +
  'disabled:bg-disabled disabled:text-fg-disabled disabled:shadow-none';

const SIZE: Record<Size, string> = {
  s: 'h-6 min-w-10 px-2 text-desc font-medium',
  m: 'h-9 min-w-14 px-3 text-body-s font-medium',
  l: 'h-12 min-w-19 px-4 text-body-m font-medium',
  xl: 'h-14 min-w-[90px] px-5 text-body-m font-medium',
};

const ICON_SIZE: Record<Size, string> = { s: 'size-4', m: 'size-4', l: 'size-5', xl: 'size-5' };

const LOOK: Record<Scheme, Record<Variant, string>> = {
  accent: {
    primary: 'bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-active',
    secondary:
      'bg-accent-container text-accent hover:bg-accent-container-hover active:bg-accent-container-active',
    outline:
      'bg-transparent text-accent shadow-[inset_0_0_0_1px_var(--atmr-accent-muted)] hover:bg-accent-container',
    ghost: 'bg-transparent text-accent hover:bg-accent-container',
    danger: 'bg-error text-white hover:brightness-95',
  },
  neutral: {
    primary: 'bg-neutral text-on-neutral hover:bg-neutral-hover',
    secondary:
      'bg-neutral-container text-fg hover:bg-neutral-container-hover active:bg-neutral-container-active',
    outline:
      'bg-transparent text-fg shadow-[inset_0_0_0_1px_var(--atmr-border-soft)] hover:bg-neutral-container',
    ghost: 'bg-transparent text-fg hover:bg-neutral-container',
    danger: 'bg-error text-white hover:brightness-95',
  },
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** По умолчанию: primary — accent, остальные варианты — neutral. */
  scheme?: Scheme;
  size?: Size;
  icon?: IconName;
  iconAfter?: IconName;
  loading?: boolean;
  children?: ReactNode;
}

// oxlint-disable-next-line react/only-export-components
export function buttonClass({
  variant = 'secondary',
  scheme,
  size = 'l',
  className,
}: {
  variant?: Variant;
  scheme?: Scheme;
  size?: Size;
  className?: string;
}) {
  const resolved = scheme ?? (variant === 'primary' ? 'accent' : 'neutral');
  return clsx(BASE, SIZE[size], LOOK[resolved][variant], className);
}

// oxlint-disable-next-line react/only-export-components
export function Button({
  variant = 'secondary',
  scheme,
  size = 'l',
  icon,
  iconAfter,
  loading,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, scheme, size, className })}
      {...rest}
    >
      {loading ? (
        <Spinner className="size-4" />
      ) : (
        icon && <Icon name={icon} className={ICON_SIZE[size]} />
      )}
      {children !== undefined && children !== null && <span className="px-1">{children}</span>}
      {iconAfter && !loading && <Icon name={iconAfter} className={ICON_SIZE[size]} />}
    </button>
  );
}

/* IconButton: l 48 | m 36, скругление buttons, фон neutral-container. */
type IconVariant = 'secondary' | 'ghost' | 'primary' | 'onCard' | 'current';

const ICON_LOOK: Record<IconVariant, string> = {
  secondary:
    'bg-neutral-container text-fg hover:bg-neutral-container-hover active:bg-neutral-container-active',
  ghost: 'bg-transparent text-fg hover:bg-neutral-container',
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  onCard: 'bg-card text-fg hover:bg-surface-3',
  current: 'bg-accent text-on-accent hover:bg-accent-hover',
};

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  /** Обязателен: иконка без подписи сама себя не объясняет. */
  label: string;
  variant?: IconVariant;
  size?: 'm' | 'l';
  /** Стрелка «перейти» тянется к углу при наведении. */
  go?: boolean;
  /** Точка-индикатор, как у колокольчика уведомлений. */
  dot?: boolean;
  showLabel?: boolean;
}

// oxlint-disable-next-line react/only-export-components
export function IconButton({
  icon,
  label,
  variant = 'secondary',
  size = 'l',
  go,
  dot,
  showLabel = false,
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={clsx(
        'group/ibtn relative inline-grid shrink-0 place-items-center rounded-m border-0',
        'transition-[background-color,transform] duration-150 ease-productive active:scale-[.94] active:duration-100',
        'disabled:pointer-events-none disabled:text-fg-disabled',
        showLabel ? 'h-12 w-full justify-start gap-3 px-3' : size === 'l' ? 'size-12' : 'size-9',
        ICON_LOOK[variant],
        className,
      )}
      {...rest}
    >
      <Icon
        name={icon}
        className={clsx(
          size === 'l' ? 'size-6' : 'size-5',
          go &&
            'transition-transform duration-300 ease-bounce group-hover/ibtn:translate-x-0.5 group-hover/ibtn:-translate-y-0.5',
        )}
      />
      {showLabel && <span className="whitespace-nowrap text-body-m">{label}</span>}
      {dot && (
        <i
          aria-hidden="true"
          className="absolute top-2.5 right-[11px] size-2 rounded-full bg-accent shadow-[0_0_0_2px_var(--atmr-bg-surface1)]"
        />
      )}
    </button>
  );
}

// oxlint-disable-next-line react/only-export-components
export function Spinner({ className = 'size-4' }: { className?: string }) {
  return (
    <i
      aria-hidden="true"
      className={clsx(
        'inline-block shrink-0 rounded-full border-2 border-current border-r-transparent animate-[spin_600ms_linear_infinite]',
        className,
      )}
    />
  );
}

/* Chip — всегда капсула. s 32 | m 40 | l 48. Выбранный — accent. */
type ChipSize = 's' | 'm' | 'l';

const CHIP_SIZE: Record<ChipSize, string> = {
  s: 'h-8 px-3 text-body-s gap-2',
  m: 'h-10 px-4 text-body-s gap-2',
  l: 'h-12 pl-4 pr-5 text-body-m gap-2',
};

// oxlint-disable-next-line react/only-export-components
export function chipClass({
  size = 'm',
  selected,
  outline,
  interactive = true,
  className,
}: {
  size?: ChipSize;
  selected?: boolean;
  outline?: boolean;
  interactive?: boolean;
  className?: string;
}) {
  return clsx(
    'inline-flex shrink-0 items-center whitespace-nowrap rounded-full border-0 no-underline',
    'transition-[background-color,color,transform] duration-150 ease-productive',
    CHIP_SIZE[size],
    selected
      ? 'bg-accent text-white hover:bg-accent-hover'
      : outline
        ? 'bg-transparent text-fg shadow-[inset_0_0_0_1px_var(--atmr-border-soft)]'
        : 'bg-neutral-container text-fg',
    interactive
      ? clsx(
          'cursor-pointer active:scale-[.97] active:duration-100',
          !selected && 'hover:bg-neutral-container-hover active:bg-neutral-container-active',
        )
      : 'cursor-default',
    className,
  );
}

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: ChipSize;
  selected?: boolean;
  outline?: boolean;
  icon?: IconName;
}

export function Chip({
  size = 'm',
  selected,
  outline,
  icon,
  className,
  children,
  ...rest
}: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={chipClass({ size, selected, outline, className })}
      {...rest}
    >
      {icon && <Icon name={icon} className="size-5" />}
      {children}
    </button>
  );
}

/** A static chip — a fact, not a control. */
export function ChipStatic({
  size = 'm',
  className,
  children,
  ...rest
}: { size?: ChipSize } & AnchorHTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={chipClass({ size, interactive: false, className })} {...rest}>
      {children}
    </span>
  );
}
