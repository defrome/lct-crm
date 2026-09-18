import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { interactionsApi } from '@/api/endpoints';
import { useMessages } from '@/api/queries';
import { useAuth } from '@/app/AuthProvider';
import { useToast } from '@/app/ToastProvider';
import { Button } from '@/components/ui/Button';
import { CardHeader, ErrorState, Skeleton } from '@/components/ui/States';
import { TextArea } from '@/components/ui/Field';
import { formatDateTime, shortName } from '@/lib/format';

export function ChatPanel({ interactionId }: { interactionId: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const client = useQueryClient();
  const messages = useMessages(interactionId);
  const [body, setBody] = useState('');

  const send = useMutation({
    mutationFn: () => interactionsApi.sendMessage(interactionId, { body: body.trim() }),
    onSuccess: () => {
      setBody('');
      void client.invalidateQueries({ queryKey: ['interactions', interactionId, 'messages'] });
    },
    onError: (error) => toast.fail(error, 'Не удалось отправить сообщение'),
  });

  return (
    <section className="card card-pad">
      <CardHeader title="Обсуждение карточки" sub="Текст виден участникам с доступом к карточке" />
      <div className="mt-5 flex flex-col gap-3">
        {messages.isPending ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-14 w-4/5" />
            <Skeleton className="ml-auto h-14 w-4/5" />
          </div>
        ) : messages.error ? (
          <ErrorState error={messages.error} onRetry={() => void messages.refetch()} />
        ) : messages.data?.length ? (
          <ol className="flex max-h-96 flex-col gap-3 overflow-y-auto pr-1">
            {messages.data.map((item) => {
              const own = item.author_id === user?.id;
              return (
                <li key={item.id} className={own ? 'ml-8 self-end' : 'mr-8'}>
                  <div className={own ? 'rounded-l bg-accent-container p-3' : 'rounded-l bg-surface-3 p-3'}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-desc font-medium text-fg">{shortName(item.author.full_name)}</span>
                      <time className="tnum text-desc text-fg-muted">{formatDateTime(item.created_at)}</time>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-body-s text-fg">{item.body}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="rounded-m bg-surface-3 px-3 py-4 text-body-s text-fg-muted">
            В этой карточке пока нет сообщений.
          </p>
        )}
        <form
          className="flex flex-col gap-3 border-t border-border-soft pt-4 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (body.trim()) send.mutate();
          }}
        >
          <TextArea
            label="Новое сообщение"
            aria-label="Новое сообщение"
            placeholder="Напишите комментарий для участников карточки"
            rows={2}
            maxLength={5000}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            className="flex-1"
          />
          <Button type="submit" variant="primary" icon="comment" loading={send.isPending} disabled={!body.trim()}>
            Отправить
          </Button>
        </form>
      </div>
    </section>
  );
}
