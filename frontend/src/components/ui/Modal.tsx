import clsx from 'clsx';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { Button, IconButton } from './Button';

/*
 * Окно: карточка CRM (surface1, скругление 2xl) с тенью bottom-xl — «уведомление,
 * окно» по шкале теней системы. Появление — productive-entrance + bouncing.
 */
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Одна строка под заголовком — зачем это окно. */
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZES = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  // `onClose` is often an inline callback from the parent. Re-running this
  // effect when a controlled field changes would move focus back to the
  // dialog after every keystroke.
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1500] flex min-w-0 items-end justify-center sm:items-center sm:p-6">
      <div
        className="animate-fade absolute inset-0 bg-overlay backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={clsx(
          'animate-pop relative flex max-h-[calc(100dvh-env(safe-area-inset-top)-0.5rem)] w-full min-w-0 flex-col bg-card shadow-bottom-xl outline-none sm:max-h-[calc(100dvh-3rem)]',
          'rounded-t-card sm:rounded-card',
          SIZES[size],
        )}
      >
        <header className="flex items-start gap-4 px-6 pt-6 pb-4 sm:px-7 sm:pt-7">
          <div className="min-w-0 flex-1">
            <h2 className="text-h2 font-bold text-fg">{title}</h2>
            {description && <p className="mt-1.5 text-body-s text-fg-muted">{description}</p>}
          </div>
          <IconButton icon="close" label="Закрыть" size="m" onClick={onClose} />
        </header>

        <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pb-5 sm:px-7 sm:pb-6">{children}</div>

        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7 sm:pb-7">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Подтверждение действия, которое нельзя отменить с того же экрана. */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  danger,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          {/* Без variant — как «Отмена» во всех остальных модалках проекта. */}
          <Button onClick={onClose} disabled={loading}>
            Отмена
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-body-m text-fg-soft">{message}</div>
    </Modal>
  );
}
