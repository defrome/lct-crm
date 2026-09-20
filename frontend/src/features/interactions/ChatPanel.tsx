import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { chatAttachmentsApi, interactionsApi } from '@/api/endpoints';
import { ATTACHMENT_FORMATS, type ChatAttachmentRead } from '@/api/types';
import { useMessages } from '@/api/queries';
import { useAuth } from '@/app/AuthProvider';
import { useToast } from '@/app/ToastProvider';
import { Button, IconButton } from '@/components/ui/Button';
import { CardHeader, ErrorState, Skeleton } from '@/components/ui/States';
import { TextArea } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { saveBlob } from '@/lib/download';
import { formatBytes, formatDateTime, shortName } from '@/lib/format';

const ACCEPT = ATTACHMENT_FORMATS.map((format) =>
  format === 'jpeg' ? '.jpg,.jpeg' : `.${format}`,
).join(',');
const MAX_FILES = 10;

export function ChatPanel({ interactionId }: { interactionId: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const client = useQueryClient();
  const messages = useMessages(interactionId);
  const [body, setBody] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const send = useMutation({
    mutationFn: async () => {
      if (files.length) return interactionsApi.sendMessageWithAttachments(interactionId, body.trim(), files);
      const message = await interactionsApi.sendMessage(interactionId, { body: body.trim() });
      return message;
    },
    onSuccess: () => {
      setBody('');
      setFiles([]);
      if (fileInput.current) fileInput.current.value = '';
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
                    {item.body && <p className="mt-1 whitespace-pre-wrap text-body-s text-fg">{item.body}</p>}
                    {item.attachments.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-1.5">
                        {item.attachments.map((attachment) => (
                          <ChatAttachment key={attachment.id} attachment={attachment} />
                        ))}
                      </ul>
                    )}
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
            if (body.trim() || files.length) send.mutate();
          }}
        >
          <div className="flex-1">
            <TextArea
              label="Новое сообщение"
              aria-label="Новое сообщение"
              placeholder="Напишите комментарий для участников карточки"
              rows={2}
              maxLength={5000}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
            {files.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2" aria-label="Выбранные вложения">
                {files.map((file, index) => (
                  <li key={`${file.name}-${file.lastModified}`} className="flex max-w-full items-center gap-1 rounded-m bg-surface-3 py-1 pr-1 pl-2 text-desc text-fg-soft">
                    <span className="truncate">{file.name} · {formatBytes(file.size)}</span>
                    <IconButton
                      icon="close"
                      label={`Убрать ${file.name}`}
                      size="m"
                      onClick={() => setFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    />
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex items-center gap-2">
              <input
                ref={fileInput}
                type="file"
                accept={ACCEPT}
                multiple
                className="sr-only"
                id={`chat-files-${interactionId}`}
                onChange={(event) => {
                  const selected = Array.from(event.target.files ?? []);
                  setFiles((current) => [...current, ...selected].slice(0, MAX_FILES));
                  event.target.value = '';
                }}
              />
              <label htmlFor={`chat-files-${interactionId}`}>
                <span className="inline-flex cursor-pointer items-center gap-1 text-desc text-fg-soft hover:text-fg">
                  <Icon name="paperclip" className="size-4" />
                  Прикрепить файл
                </span>
              </label>
              <span className="text-desc text-fg-muted">До 10 файлов, до 25 МиБ каждый</span>
            </div>
          </div>
          <Button
            type="submit"
            variant="primary"
            icon="comment"
            loading={send.isPending}
            disabled={!body.trim() && files.length === 0}
          >
            Отправить
          </Button>
        </form>
      </div>
    </section>
  );
}

function ChatAttachment({ attachment }: { attachment: ChatAttachmentRead }) {
  const toast = useToast();
  const download = useMutation({
    mutationFn: () => chatAttachmentsApi.download(attachment.id),
    onSuccess: ({ blob, filename }) => saveBlob(blob, filename ?? attachment.filename),
    onError: (error) => toast.fail(error, 'Не удалось скачать вложение'),
  });

  return (
    <li>
      <button
        type="button"
        className="flex max-w-full items-center gap-2 rounded-m bg-surface-1 px-2 py-1.5 text-left text-desc text-fg hover:bg-surface-2"
        disabled={download.isPending}
        onClick={() => download.mutate()}
      >
        <Icon name="file" className="size-4 shrink-0 text-fg-muted" />
        <span className="truncate">{attachment.filename}</span>
        <span className="tnum shrink-0 text-fg-muted">{formatBytes(attachment.size_bytes)}</span>
        <Icon name="download" className="size-4 shrink-0 text-fg-muted" />
      </button>
    </li>
  );
}
