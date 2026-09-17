import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { importsApi } from '@/api/endpoints';
import { useImportJob, useImportPresets, useImportRows } from '@/api/queries';
import type {
  ImportJobCreated,
  ImportJobRead,
  ImportRowRead,
  ImportRowStatus,
  ImportStats,
  ImportTarget,
} from '@/api/types';
import { useToast } from '@/app/ToastProvider';
import { Page } from '@/components/layout/AppShell';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Button, chipClass } from '@/components/ui/Button';
import { Pagination } from '@/components/ui/DataTable';
import { Select, TextInput } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/States';
import { saveBlob } from '@/lib/download';
import { formatBytes } from '@/lib/format';
import { FIELDS_BY_TARGET, TARGET_OPTIONS } from './fields';

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS: { step: Step; label: string }[] = [
  { step: 1, label: 'Загрузка' },
  { step: 2, label: 'Маппинг' },
  { step: 3, label: 'Предпросмотр' },
  { step: 4, label: 'Запись' },
  { step: 5, label: 'Отчёт' },
];

/** Where a job sits in the five-step flow, derived from its status. */
function stepForJob(job: ImportJobRead | undefined, mappingConfirmed: boolean): Step {
  if (!job) return 1;
  if (job.status === 'committed') return 5;
  if (job.status === 'validated') return 3;
  return mappingConfirmed ? 3 : 2;
}

export function ImportWizardPage() {
  const { jobId } = useParams<{ jobId?: string }>();
  const job = useImportJob(jobId);
  const [mappingConfirmed, setMappingConfirmed] = useState(false);
  const [upload, setUpload] = useState<ImportJobCreated | null>(null);

  const step = jobId ? stepForJob(job.data, mappingConfirmed) : 1;

  if (job.error) {
    return (
      <Page>
        <ErrorState error={job.error} onRetry={() => void job.refetch()} />
      </Page>
    );
  }

  return (
    <Page>

      <PageHeader
        back={{ to: '/imports', label: 'История импортов' }}
        eyebrow="Импорт каталога"
        title={job.data?.filename ?? 'Загрузка из Excel'}
        meta={
          job.data
            ? TARGET_OPTIONS.find((option) => option.value === job.data!.target)?.label
            : 'Файл .xlsx или .xls — данные попадут в базу только после вашего подтверждения'
        }
      />

      <StepBar current={step} />

      <div className="mt-5">
        {step === 1 && <UploadStep onUploaded={setUpload} />}
        {step === 2 && jobId && job.data && (
          <MappingStep
            job={job.data}
            suggestion={upload}
            onConfirmed={() => setMappingConfirmed(true)}
          />
        )}
        {step === 3 && jobId && job.data && (
          <PreviewStep
            job={job.data}
            onBack={() => setMappingConfirmed(false)}
            onCommitted={() => setMappingConfirmed(false)}
          />
        )}
        {step === 5 && jobId && job.data && <ReportStep job={job.data} />}
        {!job.data && jobId && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-12" />
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}

function StepBar({ current }: { current: Step }) {
  return (
    <ol className="-mt-2 mb-6 flex flex-wrap items-center gap-x-2 gap-y-2">
      {STEPS.map(({ step, label }, index) => {
        const done = step < current;
        const active = step === current;
        return (
          <li key={step} className="flex items-center gap-1">
            <span
              aria-current={active ? 'step' : undefined}
              className={chipClass({
                size: 'm',
                selected: active,
                interactive: false,
                className: done ? 'bg-s01-container text-s01 dark:text-s01-200' : '',
              })}
            >
              {done ? (
                <Icon name="check" className="size-4" strokeWidth={2} />
              ) : (
                <span className="tnum opacity-70">{step}</span>
              )}
              {label}
            </span>
            {index < STEPS.length - 1 && (
              <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-line-soft" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// --- Шаг 1. Загрузка ---------------------------------------------------------

function UploadStep({ onUploaded }: { onUploaded: (result: ImportJobCreated) => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const client = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<ImportTarget>('interactions');
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  const send = useMutation({
    mutationFn: () => importsApi.upload(file!, target),
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: ['imports'] });
      onUploaded(result);
      if (result.duplicate_of) {
        toast.notify('Файл уже загружали', 'Проверьте предпросмотр — повтор перезапишет карточки');
      }
      navigate(`/imports/${result.job.id}`);
    },
    onError: (error) => toast.fail(error, 'Не удалось загрузить файл'),
  });

  const chosen = TARGET_OPTIONS.find((option) => option.value === target)!;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="card card-pad">
        <h2 className="card-title mb-5">Файл каталога</h2>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const dropped = event.dataTransfer.files?.[0];
            if (dropped) setFile(dropped);
          }}
          className={
            'flex flex-col items-center gap-3 rounded-l border border-dashed px-4 py-12 text-center transition-colors ' +
            (dragging ? 'border-accent bg-accent-container' : 'border-line-soft bg-surface-3')
          }
        >
          <Icon name="upload" className="size-7 text-fg-muted" />
          {file ? (
            <>
              <p className="text-body-s font-medium text-fg">{file.name}</p>
              <p className="tnum text-desc text-fg-muted">{formatBytes(file.size)}</p>
              <Button size="m" onClick={() => setFile(null)}>
                Выбрать другой
              </Button>
            </>
          ) : (
            <>
              <p className="text-body-s text-fg">Перетащите файл сюда</p>
              <p className="text-desc text-fg-muted">.xlsx или .xls, до 20 МБ</p>
              <Button size="m" onClick={() => inputRef.current?.click()}>
                Выбрать файл
              </Button>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="sr-only"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </div>

        <div className="mt-5 flex justify-end">
          <Button
            variant="primary"
            size="xl"
            icon="arrowRight"
            disabled={!file}
            loading={send.isPending}
            onClick={() => send.mutate()}
          >
            Разобрать файл
          </Button>
        </div>
      </section>

      <section className="card card-pad">
        <h2 className="card-title mb-5">Что загружаем</h2>
        <div className="flex flex-col gap-2">
          {TARGET_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setTarget(option.value)}
              aria-pressed={option.value === target}
              className={
                'cursor-pointer rounded-xl border-0 px-4 py-3 text-left transition-[background-color,box-shadow] duration-150 ' +
                (option.value === target
                  ? 'bg-accent-container shadow-[inset_0_0_0_2px_var(--atmr-accent-default)]'
                  : 'bg-surface-3 hover:bg-neutral-container')
              }
            >
              <span className="block text-body-m font-medium text-fg">
                {option.label}
              </span>
              <span className="mt-0.5 block text-body-s text-fg-muted">
                {option.hint}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-6">
          <p className="text-h4 font-bold text-fg mb-3">Ожидаемые колонки</p>
          <ul className="flex flex-wrap gap-1">
            {FIELDS_BY_TARGET[chosen.value].map((field) => (
              <li key={field.path}>
                <Badge tone={field.required ? 's01' : 'neutral'}>
                  {field.title}
                  {field.required && ' *'}
                </Badge>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-desc text-fg-muted">
            Названия колонок в файле могут отличаться — на следующем шаге вы сопоставите их с
            полями системы.
          </p>
        </div>
      </section>
    </div>
  );
}

// --- Шаг 2. Маппинг ----------------------------------------------------------

function MappingStep({
  job,
  suggestion,
  onConfirmed,
}: {
  job: ImportJobRead;
  suggestion: ImportJobCreated | null;
  onConfirmed: () => void;
}) {
  const toast = useToast();
  const client = useQueryClient();
  const presets = useImportPresets(job.target);
  const fields = FIELDS_BY_TARGET[job.target];

  const headers = suggestion?.headers ?? job.source_headers ?? [];
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState('');

  // Start from whatever is already known: a saved mapping on the job, otherwise
  // the server's fuzzy suggestion. The user only corrects what it got wrong.
  useEffect(() => {
    if (Object.keys(job.mapping ?? {}).length > 0) {
      setMapping(job.mapping);
      return;
    }
    const suggested: Record<string, string> = {};
    for (const item of suggestion?.suggested_mapping ?? []) {
      if (item.field) suggested[item.column] = item.field;
    }
    setMapping(suggested);
  }, [job.mapping, suggestion]);

  const confidenceByColumn = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of suggestion?.suggested_mapping ?? []) map.set(item.column, item.confidence);
    return map;
  }, [suggestion]);

  const usedFields = new Set(Object.values(mapping));
  const missingRequired = fields.filter(
    (field) => field.required && !usedFields.has(field.path),
  );

  const confirm = useMutation({
    mutationFn: (saveAs?: string) =>
      importsApi.setMapping(job.id, { mapping, save_as_preset: saveAs ?? null }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['imports'] });
      setSavingPreset(false);
      setPresetName('');
      onConfirmed();
    },
    onError: (error) => toast.fail(error, 'Не удалось сохранить сопоставление'),
  });

  const applyPreset = (presetId: string) => {
    const preset = presets.data?.items.find((item) => item.id === presetId);
    if (!preset) return;
    setMapping(preset.mapping);
    toast.notify('Шаблон применён', preset.name);
  };

  return (
    <div className="flex flex-col gap-4">
      {(suggestion?.warnings?.length || suggestion?.duplicate_of) && (
        <div className="card flex flex-col gap-2 border-warning/25 bg-warning-container p-3.5">
          {suggestion.duplicate_of && (
            <p className="flex items-start gap-2 text-body-s text-warning">
              <Icon name="alert" className="mt-px size-4 shrink-0" />
              Такой файл уже загружали. Повторная запись обновит существующие карточки, а не создаст
              дубли.
            </p>
          )}
          {suggestion.warnings?.map((warning) => (
            <p key={warning} className="flex items-start gap-2 text-body-s text-warning">
              <Icon name="info" className="mt-px size-4 shrink-0" />
              {warning}
            </p>
          ))}
        </div>
      )}

      <section className="card overflow-hidden">
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4 sm:px-7 sm:pt-7">
          <div>
            <h2 className="card-title">Колонки файла и поля системы</h2>
            <p className="card-sub mt-1.5">
              Распознано {Object.keys(mapping).length} из {headers.length}
            </p>
          </div>
          {(presets.data?.items.length ?? 0) > 0 && (
            <Select
              aria-label="Применить шаблон маппинга"
              placeholder="Применить шаблон"
              value=""
              onChange={(event) => event.target.value && applyPreset(event.target.value)}
              options={(presets.data?.items ?? []).map((preset) => ({
                value: preset.id,
                label: preset.name,
              }))}
              className="w-56"
            />
          )}
        </header>

        <ul className="flex flex-col px-3 pb-3 sm:px-5 sm:pb-5">
          {headers.map((header) => {
            const value = mapping[header] ?? '';
            const confidence = confidenceByColumn.get(header);
            return (
              <li
                key={header}
                className="grid grid-cols-1 items-center gap-2 rounded-l px-2 py-2 transition-colors hover:bg-surface-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-body-s text-fg">{header}</p>
                  {confidence !== undefined && confidence > 0 && !value && (
                    <p className="text-desc text-fg-muted">не распознано</p>
                  )}
                </div>

                <Icon name="arrowRight" className="hidden size-4 text-fg-muted sm:block" />

                <Select
                  aria-label={`Поле системы для колонки ${header}`}
                  placeholder="Не импортировать"
                  value={value}
                  onChange={(event) =>
                    setMapping((current) => {
                      const next = { ...current };
                      if (event.target.value) next[header] = event.target.value;
                      else delete next[header];
                      return next;
                    })
                  }
                  options={fields.map((field) => ({
                    value: field.path,
                    label:
                      field.title +
                      (field.required ? ' *' : '') +
                      (usedFields.has(field.path) && mapping[header] !== field.path
                        ? ' — уже занято'
                        : ''),
                  }))}
                />
              </li>
            );
          })}
        </ul>
      </section>

      {missingRequired.length > 0 && (
        <p className="flex items-start gap-2 text-body-s text-error">
          <Icon name="alert" className="mt-px size-4 shrink-0" />
          Не сопоставлено обязательное поле:{' '}
          {missingRequired.map((field) => field.title).join(', ')}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button icon="file" onClick={() => setSavingPreset(true)} disabled={confirm.isPending}>
          Сохранить как шаблон
        </Button>
        <Button
          variant="primary"
          size="xl"
          iconAfter="arrowRight"
          loading={confirm.isPending}
          disabled={missingRequired.length > 0}
          onClick={() => confirm.mutate(undefined)}
        >
          К предпросмотру
        </Button>
      </div>

      <Modal
        open={savingPreset}
        onClose={() => setSavingPreset(false)}
        size="sm"
        title="Сохранить шаблон маппинга"
        description="Пригодится, если такой файл приходит регулярно"
        footer={
          <>
            <Button onClick={() => setSavingPreset(false)}>Отмена</Button>
            <Button
              variant="primary"
              loading={confirm.isPending}
              disabled={presetName.trim().length === 0}
              onClick={() => confirm.mutate(presetName.trim())}
            >
              Сохранить и продолжить
            </Button>
          </>
        }
      >
        <TextInput
          label="Название шаблона"
          required
          autoFocus
          placeholder="Ежемесячный файл от вузов"
          value={presetName}
          onChange={(event) => setPresetName(event.target.value)}
        />
      </Modal>
    </div>
  );
}

// --- Шаг 3–4. Предпросмотр и запись -----------------------------------------

const ROW_TONE: Record<ImportRowStatus, Tone> = { ok: 'success', warning: 'warning', error: 'error' };
const ROW_LABEL: Record<ImportRowStatus, string> = {
  ok: 'Без замечаний',
  warning: 'Предупреждение',
  error: 'Ошибка',
};

function PreviewStep({
  job,
  onBack,
  onCommitted,
}: {
  job: ImportJobRead;
  onBack: () => void;
  onCommitted: () => void;
}) {
  const toast = useToast();
  const client = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ImportRowStatus | ''>('');
  const [page, setPage] = useState(1);

  const validate = useMutation({
    mutationFn: () => importsApi.validate(job.id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['imports'] });
    },
    onError: (error) => toast.fail(error, 'Не удалось выполнить проверку'),
  });

  const commit = useMutation({
    mutationFn: () => importsApi.commit(job.id),
    onSuccess: (result) => {
      void client.invalidateQueries({ queryKey: ['imports'] });
      void client.invalidateQueries({ queryKey: ['interactions'] });
      void client.invalidateQueries({ queryKey: ['universities'] });
      void client.invalidateQueries({ queryKey: ['products'] });
      toast.notify(
        'Данные записаны',
        `Создано ${result.stats.created ?? 0}, обновлено ${result.stats.updated ?? 0}`,
      );
      onCommitted();
    },
    onError: (error) => toast.fail(error, 'Не удалось записать данные'),
  });

  // The dry-run runs as soon as the mapping is confirmed — the user asked to see
  // the preview, not to press another button to build it.
  const validated = job.status === 'validated';
  useEffect(() => {
    if (!validated && !validate.isPending && !validate.isSuccess) validate.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validated]);

  const rows = useImportRows(validated ? job.id : undefined, {
    status: statusFilter || undefined,
    page,
    size: 25,
  });

  const stats: ImportStats = job.stats ?? {};
  const hasErrors = (stats.errors ?? 0) > 0;

  if (!validated) {
    return (
      <div className="card px-6 py-16 text-center">
        <p className="text-body-s text-fg">Проверяем строки…</p>
        <p className="mt-1 text-body-s text-fg-muted">
          Считаем, что будет создано и обновлено. Рабочие данные пока не меняются.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatBox label="Всего строк" value={stats.total ?? 0} />
        <StatBox label="Будет создано" value={stats.to_create ?? 0} tone="ok" />
        <StatBox label="Будет обновлено" value={stats.to_update ?? 0} tone="info" />
        <StatBox label="Предупреждения" value={stats.warnings ?? 0} tone="warn" />
        <StatBox label="Ошибки" value={stats.errors ?? 0} tone="bad" />
      </div>

      <section className="card overflow-hidden">
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 pb-4 sm:px-7 sm:pt-7">
          <h2 className="card-title">Что произойдёт со строками</h2>
          <div className="flex flex-wrap items-center gap-2">
            {(['', 'ok', 'warning', 'error'] as const).map((value) => (
              <button
                key={value || 'all'}
                type="button"
                aria-pressed={statusFilter === value}
                onClick={() => {
                  setStatusFilter(value);
                  setPage(1);
                }}
                className={chipClass({ size: 's', selected: statusFilter === value })}
              >
                {value === '' ? 'Все' : ROW_LABEL[value]}
              </button>
            ))}
          </div>
        </header>

        {rows.isPending ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-10" />
            ))}
          </div>
        ) : (rows.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            compact
            icon="check"
            title="Строк с таким статусом нет"
            message="Переключите фильтр, чтобы посмотреть остальные."
          />
        ) : (
          <ul className="flex flex-col px-3 pb-3 sm:px-5 sm:pb-5">
            {rows.data!.items.map((row) => (
              <RowPreview key={row.id} row={row} />
            ))}
          </ul>
        )}

        {rows.data && (
          <Pagination
            page={rows.data.page}
            pages={rows.data.pages}
            total={rows.data.total}
            size={rows.data.size}
            noun={['строка', 'строки', 'строк']}
            onPageChange={setPage}
          />
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-lg text-desc text-fg-muted">
          {hasErrors
            ? `Строк с ошибками: ${stats.errors}. Они будут пропущены, остальные запишутся.`
            : 'Ошибок нет. Пустые ячейки не стирают уже заполненные значения.'}
        </p>
        <div className="flex gap-2">
          <Button icon="arrowLeft" onClick={onBack} disabled={commit.isPending}>
            Вернуться к маппингу
          </Button>
          <Button
            variant="primary"
            size="xl"
            icon="check"
            loading={commit.isPending}
            onClick={() => commit.mutate()}
          >
            Записать в базу
          </Button>
        </div>
      </div>
    </div>
  );
}

function RowPreview({ row }: { row: ImportRowRead }) {
  const [open, setOpen] = useState(false);

  // `raw_data` is the spreadsheet as the user typed it, keyed by their own
  // column headings. `parsed_data` is the importer's working state — dedupe
  // keys and resolved ids — which would only confuse someone checking their file.
  const cells = Object.entries(row.raw_data ?? {}).filter(
    ([, value]) => value !== null && value !== undefined && String(value).trim() !== '',
  );

  const messages = messagesOf(row);
  const summary =
    messages.join(' · ') ||
    cells
      .slice(0, 3)
      .map(([, value]) => String(value))
      .join(' · ');

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className="flex w-full cursor-pointer items-center gap-3 rounded-l border-0 bg-transparent px-2 py-2.5 text-left transition-colors hover:bg-surface-3"
      >
        <span className="tnum w-10 shrink-0 text-desc text-fg-muted">
          {row.row_number}
        </span>
        <Badge tone={ROW_TONE[row.status]}>
          <Icon
            name={row.status === 'ok' ? 'check' : row.status === 'warning' ? 'info' : 'alert'}
            className="size-3"
          />
          {ROW_LABEL[row.status]}
        </Badge>
        {row.resolved_entity_id && row.status !== 'error' && (
          <Badge tone="info">обновит существующую</Badge>
        )}
        <span className="min-w-0 flex-1 truncate text-body-s text-fg-soft">{summary}</span>
        <Icon name={open ? 'chevronUp' : 'chevronDown'} className="size-4 shrink-0 text-fg-muted" />
      </button>

      {open && (
        <div className="mt-1 mb-2 rounded-l bg-surface-3 px-4 py-3">
          {messages.length > 0 && (
            <ul className="mb-3 flex flex-col gap-1">
              {messages.map((message, index) => (
                <li
                  key={index}
                  className={
                    'text-body-s ' + (row.status === 'error' ? 'text-error' : 'text-warning')
                  }
                >
                  {message}
                </li>
              ))}
            </ul>
          )}
          <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {cells.map(([header, value]) => (
              <div key={header} className="flex gap-2 text-desc">
                <dt className="shrink-0 text-fg-muted">{header}:</dt>
                <dd className="min-w-0 truncate text-fg">{String(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </li>
  );
}

/**
 * Row messages arrive as `{text, level, field, suggestion}` objects — the API
 * spells the wording `text`, not `message` — and occasionally as plain strings.
 * These messages are the point of the dry-run, so a missed shape means the user
 * sees a red row with no reason attached.
 */
function messagesOf(row: ImportRowRead): string[] {
  return (row.messages ?? [])
    .map((item) => {
      if (typeof item === 'string') return item;
      const text = item.text ?? (item.message as string | undefined) ?? '';
      return item.suggestion ? `${text} — возможно, «${item.suggestion}»` : text;
    })
    .filter(Boolean);
}

function StatBox({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'neutral' | 'ok' | 'warn' | 'bad' | 'info';
}) {
  const color =
    tone === 'ok'
      ? 'text-success'
      : tone === 'warn'
        ? 'text-warning'
        : tone === 'bad'
          ? 'text-error'
          : tone === 'info'
            ? 'text-info'
            : 'text-fg';
  return (
    <div className="card p-3">
      <p className="cap">{label}</p>
      <p className={`tnum mt-1.5 text-h1 font-medium ${color}`}>{value}</p>
    </div>
  );
}

// --- Шаг 5. Отчёт ------------------------------------------------------------

function ReportStep({ job }: { job: ImportJobRead }) {
  const toast = useToast();
  const stats = job.stats ?? {};

  const download = useMutation({
    mutationFn: () => importsApi.report(job.id),
    onSuccess: ({ blob, filename }) => saveBlob(blob, filename ?? `Отчёт по импорту.xlsx`),
    onError: (error) => toast.fail(error, 'Не удалось скачать отчёт'),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-col items-center gap-3 px-6 py-10 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-success-container text-success">
          <Icon name="check" className="size-6" />
        </span>
        <div>
          <p className="text-h3 font-medium text-fg">Данные записаны</p>
          <p className="mt-1 text-body-s text-fg-muted">
            Создано {stats.created ?? 0}, обновлено {stats.updated ?? 0}, пропущено{' '}
            {stats.skipped ?? 0}.
          </p>
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          <Button
            variant="primary"
            icon="download"
            loading={download.isPending}
            onClick={() => download.mutate()}
          >
            Скачать отчёт (xlsx)
          </Button>
          <Link to="/interactions">
            <Button iconAfter="arrowRight">Перейти к взаимодействиям</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatBox label="Всего строк" value={stats.total ?? 0} />
        <StatBox label="Создано" value={stats.created ?? 0} tone="ok" />
        <StatBox label="Обновлено" value={stats.updated ?? 0} tone="info" />
        <StatBox label="Пропущено" value={stats.skipped ?? 0} tone="warn" />
      </div>
    </div>
  );
}

