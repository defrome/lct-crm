import clsx from 'clsx';
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

import { Icon, type IconName } from './Icon';

/*
 * Input — по «Атомаро»: высота l (48), скругление inputs (8), фон surface1,
 * внутренняя обводка border-soft; наведение — border-default, фокус — 2px
 * accent, ошибка — 1px error. Подпись поля — description-l цвета fg-soft.
 */
export const CONTROL =
  'min-w-0 w-full rounded-m border-0 bg-surface-1 px-3 text-body-m text-fg outline-none ' +
  'shadow-[inset_0_0_0_1px_var(--atmr-border-soft)] transition-shadow duration-150 ease-productive ' +
  'hover:shadow-[inset_0_0_0_1px_var(--atmr-border-default)] ' +
  'focus:shadow-[inset_0_0_0_2px_var(--atmr-accent-default)] ' +
  'disabled:cursor-not-allowed disabled:bg-disabled disabled:text-fg-disabled disabled:shadow-none';

export const CONTROL_ERROR =
  'shadow-[inset_0_0_0_1px_var(--atmr-error-default)] hover:shadow-[inset_0_0_0_1px_var(--atmr-error-default)]';

interface FieldProps {
  label?: string;
  /** Под полем — пример или правило, но не повтор подписи. */
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (id: string) => ReactNode;
}

export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const id = useId();
  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      {label && (
        <label htmlFor={id} className="text-desc text-fg-soft">
          {label}
          {required && <span className="ml-0.5 text-accent">*</span>}
        </label>
      )}
      {children(id)}
      {error ? (
        <p className="text-desc text-error">{error}</p>
      ) : (
        hint && <p className="text-desc text-fg-muted">{hint}</p>
      )}
    </div>
  );
}

interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  hint?: string;
  error?: string;
  icon?: IconName;
  /** Табличные цифры — для кодов, ИНН и номеров договоров. */
  mono?: boolean;
}

export function TextInput({ label, hint, error, icon, mono, className, ...rest }: TextInputProps) {
  return (
    <Field label={label} hint={hint} error={error} required={rest.required} className={className}>
      {(id) => (
        <div className="relative">
          {icon && (
            <Icon
              name={icon}
              className="pointer-events-none absolute top-3 left-3 size-6 text-fg-muted"
            />
          )}
          <input
            id={id}
            className={clsx(CONTROL, 'h-12', icon && 'pl-11', mono && 'tnum', error && CONTROL_ERROR)}
            aria-invalid={error ? true : undefined}
            {...rest}
          />
        </div>
      )}
    </Field>
  );
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function TextArea({ label, hint, error, className, rows = 3, ...rest }: TextAreaProps) {
  return (
    <Field label={label} hint={hint} error={error} required={rest.required} className={className}>
      {(id) => (
        <textarea
          id={id}
          rows={rows}
          className={clsx(CONTROL, 'resize-y py-3', error && CONTROL_ERROR)}
          aria-invalid={error ? true : undefined}
          {...rest}
        />
      )}
    </Field>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  /** Первая опция с пустым значением. */
  placeholder?: string;
  options: { value: string; label: string }[];
}

export function Select({
  label,
  hint,
  error,
  placeholder,
  options,
  className,
  ...rest
}: SelectProps) {
  return (
    <Field label={label} hint={hint} error={error} required={rest.required} className={className}>
      {(id) => (
        <div className="relative">
          <select
            id={id}
            className={clsx(
              CONTROL,
              'h-12 cursor-pointer appearance-none pr-11',
              !rest.value && 'text-fg-muted',
              error && CONTROL_ERROR,
            )}
            aria-invalid={error ? true : undefined}
            {...rest}
          >
            {placeholder && <option value="">{placeholder}</option>}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Icon
            name="chevronDown"
            className="pointer-events-none absolute top-3.5 right-3 size-5 text-fg-muted"
          />
        </div>
      )}
    </Field>
  );
}

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
}

/* Checkbox: 20px, скругление xs, обводка 1.5 border-default; отмеченный — accent. */
export function Checkbox({ label, hint, className, ...rest }: CheckboxProps) {
  const id = useId();
  return (
    <div className={clsx('flex items-start gap-3', className)}>
      <span className="relative mt-0.5 grid size-5 shrink-0 place-items-center">
        <input
          id={id}
          type="checkbox"
          className={clsx(
            'peer size-5 cursor-pointer appearance-none rounded-xs',
            'shadow-[inset_0_0_0_1.5px_var(--atmr-border-default)] transition-colors duration-150',
            'checked:bg-accent checked:shadow-none disabled:cursor-not-allowed disabled:opacity-50',
          )}
          {...rest}
        />
        <span
          aria-hidden="true"
          className={clsx(
            'pointer-events-none absolute -mt-[3px] h-[5px] w-[9px] -rotate-45 scale-0 border-b-2 border-l-2 border-white',
            'transition-transform duration-200 ease-bounce peer-checked:scale-100',
          )}
        />
      </span>
      <label htmlFor={id} className="cursor-pointer text-body-m text-fg select-none">
        {label}
        {hint && <span className="block text-body-s text-fg-muted">{hint}</span>}
      </label>
    </div>
  );
}

interface SwitchProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

/* Switch: дорожка 44×24, бегунок 20 с тенью controls и productive-bouncing. */
export function Switch({ checked, onChange, label, className, ...rest }: SwitchProps) {
  return (
    <span className={clsx('inline-flex items-center gap-3', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative h-6 w-11 shrink-0 cursor-pointer rounded-full border-0 transition-colors duration-200 ease-productive',
          checked ? 'bg-accent' : 'bg-neutral-container-hover',
        )}
        {...rest}
      >
        <span
          aria-hidden="true"
          className={clsx(
            'absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-controls',
            'transition-transform duration-300 ease-bounce',
            checked && 'translate-x-5',
          )}
        />
      </button>
      <span className="text-body-m text-fg">{label}</span>
    </span>
  );
}

/**
 * SegmentedControl: контейнер neutral-container с отступом 2px, пункты 32px со
 * скруглением s; выбранный подсвечивается бегущим индикатором accent.
 */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: IconName }[];
  className?: string;
  label?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const active = container?.querySelector<HTMLButtonElement>('[aria-checked="true"]');
    if (!container || !active) return;
    setIndicator({ left: active.offsetLeft, width: active.offsetWidth });
  }, [value, options.length]);

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={label}
      className={clsx(
        'relative inline-flex gap-0.5 rounded-m bg-neutral-container p-0.5',
        className,
      )}
    >
      {indicator && (
        <span
          aria-hidden="true"
          className="absolute top-0.5 bottom-0.5 left-0 rounded-s bg-accent transition-[transform,width] duration-300 ease-productive"
          style={{ width: indicator.width, transform: `translateX(${indicator.left}px)` }}
        />
      )}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={clsx(
              'relative z-10 inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-s border-0 bg-transparent px-3 whitespace-nowrap',
              'cursor-pointer text-body-s font-medium transition-colors duration-200 ease-productive',
              active ? 'text-white' : 'text-fg',
            )}
          >
            {option.icon && <Icon name={option.icon} className="size-4" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
