import { useEffect, useState, type RefObject } from 'react';

/** Delays a fast-changing value — used so typing in a filter doesn't fire a request per keystroke. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Calls `onOutside` when a click or Escape lands outside the referenced element. */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onOutside: () => void,
): void {
  useEffect(() => {
    if (!active) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onOutside();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOutside();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [ref, active, onOutside]);
}

/** Persists a value in localStorage — used for view preferences, never for data. */
export function useStoredState<T>(key: string, initial: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    const raw = localStorage.getItem(key);
    if (raw === null) return initial;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
  });

  const update = (next: T) => {
    setValue(next);
    localStorage.setItem(key, JSON.stringify(next));
  };

  return [value, update];
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => globalThis.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const media = globalThis.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export { useFilters } from './useFilters';
