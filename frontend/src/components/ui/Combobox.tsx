import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useDismiss } from '@/hooks';
import { CONTROL, CONTROL_ERROR, Field } from './Field';
import { Icon } from './Icon';
import { Spinner } from './Button';

export interface Option {
  value: string;
  label: string;
  /** Second line — the vendor behind a product, the region of a university. */
  detail?: string;
}

interface ComboboxProps {
  value: string | null;
  onChange: (value: string | null) => void;
  options: Option[];
  /** Called as the user types; the parent runs the search against the API. */
  onSearch?: (query: string) => void;
  loading?: boolean;
  label?: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  /** Shown as a footer action, e.g. «Создать вуз». */
  onCreate?: (query: string) => void;
  createLabel?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

/**
 * A picker for records the user searches for by name rather than scrolls to:
 * universities, products, employees. Filtering happens on the server, so the
 * list stays correct when there are hundreds of entries.
 */
export function Combobox({
  value,
  onChange,
  options,
  onSearch,
  loading,
  label,
  hint,
  error,
  placeholder = 'Начните вводить название',
  onCreate,
  createLabel,
  disabled,
  required,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    onSearch?.('');
  }, [onSearch]);

  useDismiss(containerRef, open, close);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => setHighlighted(0), [options]);

  const selected = options.find((option) => option.value === value);
  const canCreate = onCreate && query.trim().length > 1;

  const choose = (option: Option) => {
    onChange(option.value);
    close();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlighted((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (options[highlighted]) choose(options[highlighted]);
      else if (canCreate) onCreate(query.trim());
    }
  };

  return (
    <Field label={label} hint={hint} error={error} required={required} className={className}>
      {(id) => (
        <div ref={containerRef} className="relative">
          <button
            id={id}
            type="button"
            disabled={disabled}
            onClick={() => setOpen((previous) => !previous)}
            aria-haspopup="listbox"
            aria-expanded={open}
            className={clsx(
              CONTROL,
              'flex h-12 cursor-pointer items-center gap-2 text-left',
              open && 'shadow-[inset_0_0_0_2px_var(--atmr-accent-default)] hover:shadow-[inset_0_0_0_2px_var(--atmr-accent-default)]',
              error && CONTROL_ERROR,
            )}
          >
            <span className={clsx('min-w-0 flex-1 truncate', !selected && 'text-fg-muted')}>
              {selected?.label ?? placeholder}
            </span>
            {value && !disabled && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Очистить"
                onClick={(event) => {
                  event.stopPropagation();
                  onChange(null);
                }}
                className="grid size-6 place-items-center rounded-s text-fg-muted transition-colors hover:bg-neutral-container hover:text-fg"
              >
                <Icon name="close" className="size-4" />
              </span>
            )}
            <Icon
              name="chevronDown"
              className={clsx(
                'size-5 shrink-0 text-fg-muted transition-transform duration-300 ease-productive',
                open && 'rotate-180',
              )}
            />
          </button>

          {open && (
            <div className="animate-menu absolute z-[1000] mt-2 w-full min-w-[220px] overflow-hidden rounded-l bg-elevated shadow-bottom-l">
              <div className="flex items-center gap-2 px-4 pt-2">
                <Icon name="search" className="size-5 shrink-0 text-fg-muted" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    onSearch?.(event.target.value);
                  }}
                  onKeyDown={onKeyDown}
                  placeholder={placeholder}
                  className="h-10 w-full border-0 bg-transparent text-body-m text-fg outline-none"
                />
                {loading && <Spinner className="size-4 text-fg-muted" />}
              </div>

              <ul role="listbox" className="max-h-72 overflow-y-auto py-2">
                {options.map((option, index) => (
                  <li key={option.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={option.value === value}
                      onMouseEnter={() => setHighlighted(index)}
                      onClick={() => choose(option)}
                      className={clsx(
                        'flex min-h-10 w-full cursor-pointer items-center justify-between gap-3 border-0 px-4 py-2 text-left text-body-m transition-colors duration-150',
                        index === highlighted ? 'bg-neutral-container' : 'bg-transparent',
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-fg">{option.label}</span>
                        {option.detail && (
                          <span className="block truncate text-body-s text-fg-muted">
                            {option.detail}
                          </span>
                        )}
                      </span>
                      {option.value === value && (
                        <Icon name="check" className="size-5 shrink-0 text-accent" />
                      )}
                    </button>
                  </li>
                ))}

                {options.length === 0 && !loading && (
                  <li className="px-4 py-6 text-center text-body-s text-fg-muted">
                    {query ? 'Ничего не нашлось' : 'Список пуст'}
                  </li>
                )}
              </ul>

              {canCreate && (
                <button
                  type="button"
                  onClick={() => {
                    onCreate(query.trim());
                    close();
                  }}
                  className="flex h-12 w-full cursor-pointer items-center gap-2 border-0 border-t border-solid border-line-muted bg-transparent px-4 text-left text-body-s font-medium text-accent transition-colors hover:bg-accent-container"
                >
                  <Icon name="plus" className="size-5" />
                  {createLabel ?? 'Создать'} «{query.trim()}»
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Field>
  );
}
