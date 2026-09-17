import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeChoice = 'light' | 'dark' | 'system';

interface ThemeState {
  choice: ThemeChoice;
  /** What is actually painted right now. */
  resolved: 'light' | 'dark';
  setChoice: (choice: ThemeChoice) => void;
}

const STORAGE_KEY = 'crm.theme';
const ThemeContext = createContext<ThemeState | null>(null);

export function useTheme(): ThemeState {
  const context = use(ThemeContext);
  if (!context) throw new Error('useTheme используется вне ThemeProvider');
  return context;
}

function systemTheme(): 'light' | 'dark' {
  return globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(
    () => (localStorage.getItem(STORAGE_KEY) as ThemeChoice | null) ?? 'system',
  );
  const [systemValue, setSystemValue] = useState<'light' | 'dark'>(systemTheme);

  useEffect(() => {
    const media = globalThis.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystemValue(media.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const resolved = choice === 'system' ? systemValue : choice;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    if (next === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ choice, resolved, setChoice }), [choice, resolved, setChoice]);
  return <ThemeContext value={value}>{children}</ThemeContext>;
}
