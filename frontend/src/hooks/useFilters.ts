import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Filter state lives in the URL.
 *
 * A filtered list is something people send each other («смотри, вот все
 * карточки Бауманки по DevOps»), and the browser's Back button should undo a
 * filter change like any other navigation. Keeping the state here gives both
 * for free, and survives a reload.
 */
export function useFilters<T extends Record<string, string | undefined>>(defaults: T) {
  const [params, setParams] = useSearchParams();

  const values = useMemo(() => {
    const result = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const value = params.get(key);
      if (value !== null) result[key as keyof T] = value as T[keyof T];
    }
    return result;
  }, [params, defaults]);

  const set = useCallback(
    (patch: Partial<Record<keyof T, string | undefined | null>>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined || value === null || value === '') next.delete(key);
            else next.set(key, String(value));
          }
          // Any change to what is being filtered starts again from page one —
          // otherwise a narrower filter lands the user on an empty page 7.
          if (!('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const reset = useCallback(() => setParams(new URLSearchParams(), { replace: true }), [setParams]);

  /** How many filters are on — drives the badge on the «Фильтры» button. */
  const activeCount = useMemo(
    () =>
      Object.keys(defaults).filter(
        (key) => key !== 'page' && key !== 'size' && key !== 'sort' && params.get(key),
      ).length,
    [params, defaults],
  );

  return { values, set, reset, activeCount };
}
