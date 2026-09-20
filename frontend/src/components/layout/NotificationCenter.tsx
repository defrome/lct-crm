import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';

import { notificationsApi } from '@/api/endpoints';
import { useNotifications } from '@/api/queries';
import { useNotificationRules } from '@/api/queries';
import { useAuth } from '@/app/AuthProvider';
import { useToast } from '@/app/ToastProvider';
import { IconButton } from '@/components/ui/Button';
import { Button } from '@/components/ui/Button';
import { Select, TextInput } from '@/components/ui/Field';
import { ConfirmModal } from '@/components/ui/Modal';
import { useDismiss } from '@/hooks';
import { formatDateTime } from '@/lib/format';

const STATUS_LABELS = { queued: 'В очереди', failed: 'Ошибка', sent: 'Отправлено' } as const;
const CHANNEL_LABELS = { email: 'Email', telegram: 'Telegram', max: 'MAX' } as const;

export function NotificationCenter() {
  const { can } = useAuth();
  const toast = useToast();
  const client = useQueryClient();
  const notifications = useNotifications();
  const rules = useNotificationRules();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  const pending = useMemo(
    () => (notifications.data ?? []).filter((item) => item.status !== 'sent').length,
    [notifications.data],
  );
  const deliver = useMutation({
    mutationFn: notificationsApi.deliver,
    onSuccess: ({ processed }) => {
      void client.invalidateQueries({ queryKey: ['notifications'] });
      toast.notify(processed ? `Обработано задач: ${processed}` : 'Очередь уведомлений пуста');
    },
    onError: (error) => toast.fail(error, 'Не удалось обработать уведомления'),
  });
  const markRead = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => toast.fail(error, 'Не удалось отметить уведомление прочитанным'),
  });
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleToRemove, setRuleToRemove] = useState<string | null>(null);
  const [days, setDays] = useState('14');
  const [channel, setChannel] = useState<'email' | 'telegram'>('email');
  const createRule = useMutation({
    mutationFn: () =>
      notificationsApi.createRule({
        stale_after_days: Number(days) || 14,
        recipient_kind: 'responsible',
        channel,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['notification-rules'] });
      setShowRuleForm(false);
      toast.notify('Правило напоминаний сохранено');
    },
    onError: (error) => toast.fail(error, 'Не удалось сохранить правило'),
  });
  const removeRule = useMutation({
    mutationFn: () => notificationsApi.removeRule(ruleToRemove!),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['notification-rules'] });
      setRuleToRemove(null);
      toast.notify('Правило уведомлений удалено');
    },
    onError: (error) => toast.fail(error, 'Не удалось удалить правило'),
  });

  return (
    <div ref={ref} className="relative">
      <IconButton
        icon="bell"
        label="Уведомления"
        variant="onCard"
        dot={pending > 0}
        onClick={() => setOpen((value) => !value)}
      />
      {open && (
        <div className="animate-menu absolute top-[calc(100%+8px)] right-0 z-[1000] w-[min(380px,calc(100vw-2rem))] origin-top-right rounded-l bg-elevated p-4 shadow-bottom-l">
          <div className="flex items-center justify-between gap-3 border-b border-border-soft pb-3">
            <div>
              <h2 className="text-body-m font-medium text-fg">Уведомления</h2>
              <p className="text-desc text-fg-muted">Состояние доставки каналов</p>
            </div>
            {can('manager') && (
              <IconButton
                icon="refresh"
                size="m"
                label="Повторить доставку"
                variant="ghost"
                disabled={deliver.isPending}
                onClick={() => deliver.mutate()}
              />
            )}
          </div>
          {notifications.isPending ? (
            <p className="py-6 text-center text-body-s text-fg-muted">Загрузка уведомлений…</p>
          ) : notifications.error ? (
            <p className="py-6 text-body-s text-error">Не удалось загрузить уведомления.</p>
          ) : notifications.data?.length ? (
            <ul className="mt-3 flex max-h-80 flex-col gap-2 overflow-y-auto">
              {notifications.data.map((item) => (
                <li key={item.id} className="rounded-m bg-surface-3 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-body-s font-medium text-fg">{CHANNEL_LABELS[item.channel]}</span>
                    <span className={item.status === 'failed' ? 'text-desc text-error' : 'text-desc text-fg-muted'}>
                      {STATUS_LABELS[item.status]}
                    </span>
                  </div>
                  <p className="mt-1 text-desc text-fg-muted">
                    Попыток: {item.attempts} · {formatDateTime(item.created_at)}
                  </p>
                  {item.error_message && <p className="mt-1 text-desc text-error">{item.error_message}</p>}
                  <div className="mt-2 flex justify-end">
                    <Button
                      type="button"
                      size="s"
                      variant="ghost"
                      loading={markRead.isPending && markRead.variables === item.id}
                      disabled={markRead.isPending}
                      onClick={() => markRead.mutate(item.id)}
                    >
                      Прочитано
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-body-s text-fg-muted">Новых уведомлений нет.</p>
          )}
          {can('manager') && (
            <div className="mt-3 border-t border-border-soft pt-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-desc font-medium text-fg">Правила напоминаний</span>
                <button
                  type="button"
                  className="cursor-pointer border-0 bg-transparent text-desc font-medium text-accent hover:text-accent-hover"
                  onClick={() => setShowRuleForm((value) => !value)}
                >
                  {showRuleForm ? 'Скрыть' : 'Добавить'}
                </button>
              </div>
              {rules.data?.length ? (
                <ul className="mt-2 flex max-h-32 flex-col gap-1 overflow-y-auto">
                  {rules.data.map((rule) => (
                    <li key={rule.id} className="flex items-center justify-between gap-2 rounded-s bg-surface-3 px-2 py-1.5">
                      <span className="min-w-0 text-desc text-fg-muted">
                        {rule.stale_after_days
                          ? `Напоминание через ${rule.stale_after_days} дн. (${CHANNEL_LABELS[rule.channel]})`
                          : `Уведомление о переходе (${CHANNEL_LABELS[rule.channel]})`}
                      </span>
                      <IconButton
                        icon="trash"
                        label="Удалить правило"
                        size="m"
                        variant="ghost"
                        onClick={() => setRuleToRemove(rule.id)}
                      />
                    </li>
                  ))}
                </ul>
              ) : null}
              {showRuleForm && (
                <form
                  className="mt-3 grid gap-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    createRule.mutate();
                  }}
                >
                  <TextInput
                    label="Порог, дней"
                    type="number"
                    min={1}
                    value={days}
                    onChange={(event) => setDays(event.target.value)}
                  />
                  <Select
                    label="Канал"
                    value={channel}
                    onChange={(event) => setChannel(event.target.value as typeof channel)}
                    options={[
                      { value: 'email', label: 'Email' },
                      { value: 'telegram', label: 'Telegram' },
                    ]}
                  />
                  <Button type="submit" size="s" variant="primary" loading={createRule.isPending}>
                    Сохранить правило
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
      <ConfirmModal
        open={ruleToRemove !== null}
        onClose={() => setRuleToRemove(null)}
        onConfirm={() => removeRule.mutate()}
        loading={removeRule.isPending}
        danger
        title="Удалить правило уведомлений?"
        confirmLabel="Удалить"
        message="Правило перестанет создавать новые уведомления. Уже созданные записи доставок останутся в журнале."
      />
    </div>
  );
}
