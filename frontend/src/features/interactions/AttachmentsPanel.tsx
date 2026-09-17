import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { attachmentsApi, interactionsApi } from '@/api/endpoints';
import { ATTACHMENT_FORMATS, type AttachmentRead, type StageRead } from '@/api/types';
import { useAuth } from '@/app/AuthProvider';
import { useToast } from '@/app/ToastProvider';
import { Button, IconButton } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { ConfirmModal, Modal } from '@/components/ui/Modal';
import { CardHeader, EmptyState } from '@/components/ui/States';
import { saveBlob } from '@/lib/download';
import { formatBytes, formatRelative } from '@/lib/format';

/** The ten formats the API accepts (FR-04), as an `accept` attribute. */
const ACCEPT = ATTACHMENT_FORMATS.map((format) =>
  format === 'jpeg' ? '.jpg,.jpeg' : `.${format}`,
).join(',');

export function AttachmentsPanel({
  interactionId,
  attachments,
  stages,
  currentStageId,
  loading,
  uploadStage,
  onUploadStageChange,
}: {
  interactionId: string;
  attachments: AttachmentRead[];
  /** Stages a file may be attached to — a file always belongs to one step. */
  stages: StageRead[];
  currentStageId: string | null;
  loading?: boolean;
  /** The route rail can open this dialog too, so the target stage is controlled. */
  uploadStage: StageRead | null;
  onUploadStageChange: (stage: StageRead | null) => void;
}) {
  const currentStage = stages.find((stage) => stage.id === currentStageId);

  return (
    <section className="card card-pad">
      <CardHeader
        title="Файлы"
        sub="Приложены к этапам маршрута"
        actions={
          currentStage && (
            <IconButton
              icon="paperclip"
              label="Приложить файл к текущему этапу"
              size="m"
              onClick={() => onUploadStageChange(currentStage)}
            />
          )
        }
      />
      <div className="mt-5">

      {loading ? (
        <div className="py-8 text-center text-body-s text-fg-muted">Загружаем…</div>
      ) : attachments.length === 0 ? (
        <EmptyState
          compact
          icon="paperclip"
          title="Файлов пока нет"
          message={
            currentStage
              ? 'Договоры, акты и письма можно приложить к текущему этапу.'
              : 'Поставьте карточку на маршрут, чтобы прикладывать файлы к этапам.'
          }
        />
      ) : (
        <ul className="-mx-2 flex flex-col">
          {attachments.map((attachment) => (
            <AttachmentRow
              key={attachment.id}
              attachment={attachment}
              interactionId={interactionId}
              stageName={stages.find((stage) => stage.id === attachment.stage_id)?.code ?? null}
            />
          ))}
        </ul>
      )}
      </div>

      <UploadModal
        interactionId={interactionId}
        stage={uploadStage}
        onClose={() => onUploadStageChange(null)}
      />
    </section>
  );
}

function AttachmentRow({
  attachment,
  interactionId,
  stageName,
}: {
  attachment: AttachmentRead;
  interactionId: string;
  stageName: string | null;
}) {
  const toast = useToast();
  const client = useQueryClient();
  const { can } = useAuth();
  const [confirming, setConfirming] = useState(false);

  const download = useMutation({
    mutationFn: () => attachmentsApi.download(attachment.id),
    onSuccess: ({ blob, filename }) => saveBlob(blob, filename ?? attachment.filename),
    onError: (error) => toast.fail(error, 'Не удалось скачать файл'),
  });

  const remove = useMutation({
    mutationFn: () => attachmentsApi.remove(attachment.id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['interactions', interactionId, 'attachments'] });
      toast.notify('Файл удалён');
      setConfirming(false);
    },
    onError: (error) => toast.fail(error, 'Не удалось удалить файл'),
  });

  return (
    <li className="flex items-center gap-3 rounded-l px-2 py-2 transition-colors hover:bg-surface-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-m bg-surface-3 text-fg-muted">
        <Icon name="file" className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-body-s text-fg">{attachment.filename}</p>
        <p className="tnum flex flex-wrap items-center gap-x-2 text-desc text-fg-muted">
          {stageName && <span className="">{stageName}</span>}
          <span>{formatBytes(attachment.size_bytes)}</span>
          <span>{formatRelative(attachment.created_at)}</span>
        </p>
        {attachment.comment && (
          <p className="mt-0.5 text-desc text-fg-soft">{attachment.comment}</p>
        )}
      </div>

      <IconButton
        icon="download"
        label={`Скачать ${attachment.filename}`}
        size="m"
        disabled={download.isPending}
        onClick={() => download.mutate()}
      />
      {can('admin') && (
        <IconButton
          icon="trash"
          label={`Удалить ${attachment.filename}`}
          size="m"
          onClick={() => setConfirming(true)}
        />
      )}

      <ConfirmModal
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        danger
        title="Удалить файл?"
        confirmLabel="Удалить"
        message={
          <>
            «{attachment.filename}» перестанет отображаться в карточке. Запись останется в журнале
            аудита.
          </>
        }
      />
    </li>
  );
}

function UploadModal({
  interactionId,
  stage,
  onClose,
}: {
  interactionId: string;
  stage: StageRead | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const client = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState('');

  const upload = useMutation({
    mutationFn: () => interactionsApi.attach(interactionId, stage!.id, file!, comment || undefined),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['interactions', interactionId] });
      toast.notify('Файл приложен');
      close();
    },
    onError: (error) => toast.fail(error, 'Не удалось приложить файл'),
  });

  const close = () => {
    setFile(null);
    setComment('');
    onClose();
  };

  return (
    <Modal
      open={Boolean(stage)}
      onClose={close}
      title="Приложить файл к этапу"
      description={stage ? `${stage.code ? stage.code + ' · ' : ''}${stage.name}` : undefined}
      footer={
        <>
          <Button onClick={close} disabled={upload.isPending}>
            Отмена
          </Button>
          <Button
            variant="primary"
            disabled={!file}
            loading={upload.isPending}
            onClick={() => upload.mutate()}
          >
            Приложить
          </Button>
        </>
      }
    >
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex w-full flex-col items-center gap-2 rounded-l border border-dashed border-line-soft bg-surface-3/50 px-4 py-8 text-center transition-colors hover:border-accent hover:bg-accent-container/40"
      >
        <Icon name="upload" className="size-6 text-fg-muted" />
        {file ? (
          <>
            <span className="text-body-s font-medium text-fg">{file.name}</span>
            <span className="tnum text-desc text-fg-muted">{formatBytes(file.size)}</span>
          </>
        ) : (
          <>
            <span className="text-body-s text-fg">Выберите файл</span>
            <span className="text-desc text-fg-muted">
              png, jpeg, pdf, zip, gzip, rar, doc, docx, xls, xlsx
            </span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />

      <TextArea
        className="mt-4"
        label="Комментарий"
        rows={2}
        placeholder="Что это за документ"
        value={comment}
        onChange={(event) => setComment(event.target.value)}
      />
    </Modal>
  );
}
