// oxlint-disable react/only-export-components
import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react';

import { ApiError } from '@/api/client';
import { Icon } from '@/components/ui/Icon';

/*
 * ToastNotification — по «Атомаро»: снизу по центру, фон neutral-990, скругление l,
 * тень bottom-xl, появление с productive-bouncing. Успех скрывается через 3 секунды
 * и повторяет название действия; ошибка держится дольше, чтобы её успели прочитать.
 */
export type ToastTone = 'ok' | 'bad';

interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  detail?: string;
  /** request id из ответа API — чтобы ошибку можно было найти в логах. */
  requestId?: string | null;
}

interface ToastState {
  notify: (title: string, detail?: string) => void;
  fail: (error: unknown, fallback?: string) => void;
}

const ToastContext = createContext<ToastState | null>(null);

// oxlint-disable-next-line react/only-export-components
export function useToast(): ToastState {
  const context = use(ToastContext);
  if (!context) throw new Error('useToast используется вне ToastProvider');
  return context;
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = nextId++;
      setToasts((current) => [...current.slice(-2), { ...toast, id }]);
      setTimeout(() => dismiss(id), toast.tone === 'bad' ? 7000 : 3000);
    },
    [dismiss],
  );

  const value = useMemo<ToastState>(
    () => ({
      notify: (title, detail) => push({ tone: 'ok', title, detail }),
      fail: (error, fallback = 'Действие не выполнено') => {
        if (error instanceof ApiError) {
          push({ tone: 'bad', title: fallback, detail: error.message, requestId: error.requestId });
        } else {
          push({ tone: 'bad', title: fallback, detail: (error as Error)?.message });
        }
      },
    }),
    [push],
  );

  return (
    <ToastContext value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-6 left-1/2 z-[1600] flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 flex-col items-center gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="animate-toast pointer-events-auto flex min-w-[280px] max-w-full items-center gap-3 rounded-l bg-inverse px-4 py-3 text-body-s text-on-inverse shadow-bottom-xl"
          >
            <span
              className={
                /*
                 * text-white здесь — не обход токенов: success и error одинаковы
                 * в обеих темах, а on-inverse, который наследуется от плашки,
                 * в тёмной теме тёмный и на зелёном кружке читался бы хуже.
                 */
                'grid size-6 shrink-0 place-items-center self-start rounded-full text-white ' +
                (toast.tone === 'ok' ? 'bg-success' : 'bg-error')
              }
            >
              <Icon
                name={toast.tone === 'ok' ? 'check' : 'close'}
                className="size-3.5"
                strokeWidth={2.4}
              />
            </span>
            <div className="min-w-0 flex-1">
              <p>{toast.title}</p>
              {toast.detail && <p className="mt-0.5 text-on-inverse opacity-70">{toast.detail}</p>}
              {toast.requestId && (
                <p className="tnum mt-0.5 text-desc text-on-inverse opacity-50">
                  запрос {toast.requestId.slice(0, 8)}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="grid size-6 shrink-0 cursor-pointer place-items-center self-start rounded-s border-0 bg-transparent text-on-inverse opacity-60 transition-opacity hover:opacity-100"
              aria-label="Закрыть уведомление"
            >
              <Icon name="close" className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext>
  );
}
