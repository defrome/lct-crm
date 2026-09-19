import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';

import { stagesApi, transitionsApi, workflowsApi } from '@/api/endpoints';
import { useWorkflow, useWorkflowGraph, useWorkflowVersions } from '@/api/queries';
import type { MigrationPreview, StageRead, TransitionRead, UUID, VersionRead } from '@/api/types';
import { useAuth } from '@/app/AuthProvider';
import { useToast } from '@/app/ToastProvider';
import { Page } from '@/components/layout/AppShell';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Button, IconButton, chipClass } from '@/components/ui/Button';
import { Checkbox, Select, TextArea, TextInput } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { ConfirmModal, Modal } from '@/components/ui/Modal';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/States';
import { formatDate } from '@/lib/format';
import { WorkflowFormModal } from './WorkflowsPage';

const VERSION_TONE: Record<string, Tone> = {
  draft: 'warning',
  published: 'success',
  archived: 'neutral',
};

const VERSION_LABEL: Record<string, string> = {
  draft: 'черновик',
  published: 'опубликована',
  archived: 'архив',
};

export function WorkflowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const toast = useToast();
  const client = useQueryClient();

  const workflow = useWorkflow(id);
  const versions = useWorkflowVersions(id);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  // Default to what the cards actually run on; fall back to the newest draft.
  const version = useMemo<VersionRead | undefined>(() => {
    const list = versions.data ?? [];
    if (selectedVersionId) return list.find((item) => item.id === selectedVersionId);
    return list.find((item) => item.status === 'published') ?? list[0];
  }, [versions.data, selectedVersionId]);

  const graph = useWorkflowGraph(id, version?.id);
  const [editing, setEditing] = useState(false);
  const [addingStage, setAddingStage] = useState(false);
  const [addingTransition, setAddingTransition] = useState(false);

  const isDraft = version?.status === 'draft';
  const editable = isDraft && can('manager');

  const createDraft = useMutation({
    mutationFn: () => workflowsApi.createVersion(id!, { clone_from_id: version?.id ?? null }),
    onSuccess: (created) => {
      void client.invalidateQueries({ queryKey: ['workflows', id!] });
      setSelectedVersionId(created.id);
      toast.notify('Черновик создан', `Версия ${created.version} — копия текущей`);
    },
    onError: (error) => toast.fail(error, 'Не удалось создать черновик'),
  });

  const [publishing, setPublishing] = useState(false);

  if (workflow.error) {
    return (
      <Page>
        <ErrorState error={workflow.error} onRetry={() => void workflow.refetch()} />
      </Page>
    );
  }

  const stages = [...(graph.data?.stages ?? [])].sort((a, b) => a.order_index - b.order_index);
  const transitions = graph.data?.transitions ?? [];
  const cardsPerStage = new Map(
    (graph.data?.cards_per_stage ?? []).map((item) => [item.stage_id, item.cards]),
  );

  return (
    <Page>

      <PageHeader
        back={{ to: '/workflows', label: 'Все процессы' }}
        eyebrow="Процесс"
        title={workflow.data?.name ?? <Skeleton className="h-7 w-72" />}
        meta={workflow.data?.description}
        actions={
          can('manager') && (
            <>
              <Button icon="edit" onClick={() => setEditing(true)}>
                Изменить
              </Button>
              {isDraft ? (
                <Button
                  variant="primary"
                  icon="check"
                  disabled={stages.length === 0}
                  onClick={() => setPublishing(true)}
                >
                  Опубликовать версию
                </Button>
              ) : (
                <Button
                  variant="primary"
                  icon="edit"
                  loading={createDraft.isPending}
                  onClick={() => createDraft.mutate()}
                >
                  Изменить маршрут
                </Button>
              )}
            </>
          )
        }
      />

      <VersionBar
        versions={versions.data ?? []}
        current={version}
        onSelect={setSelectedVersionId}
        loading={versions.isPending}
      />

      {isDraft && (
        <p className="mt-4 flex items-start gap-2 rounded-m border border-warning/25 bg-warning-container px-3 py-2.5 text-body-s text-warning">
          <Icon name="info" className="mt-px size-4 shrink-0" />
          Это черновик. Карточки продолжают идти по опубликованной версии, пока вы не опубликуете
          эту.
        </p>
      )}

      <div className="mt-4 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="card card-pad">
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="card-title">Этапы маршрута</h2>
              <p className="card-sub mt-1.5">
                {stages.length > 0
                  ? `${stages.length} шагов, в порядке прохождения`
                  : 'Порядок, в котором карточка идёт по процессу'}
              </p>
            </div>
            {editable && (
              <Button size="m" icon="plus" onClick={() => setAddingStage(true)}>
                Добавить этап
              </Button>
            )}
          </header>

          {graph.isPending ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-8" />
              ))}
            </div>
          ) : stages.length === 0 ? (
            <EmptyState
              compact
              icon="route"
              title="Этапов пока нет"
              message={
                editable
                  ? 'Добавьте первый шаг — с него будут стартовать карточки.'
                  : 'В этой версии не задано ни одного этапа.'
              }
              action={
                editable && (
                  <Button icon="plus" onClick={() => setAddingStage(true)}>
                    Добавить этап
                  </Button>
                )
              }
            />
          ) : (
            <ol className="flex flex-col">
              {stages.map((stage, index) => (
                <StageRow
                  key={stage.id}
                  stage={stage}
                  index={index}
                  last={index === stages.length - 1}
                  cards={cardsPerStage.get(stage.id) ?? 0}
                  editable={Boolean(editable)}
                  renamable={can('manager') && (isDraft || can('admin'))}
                  workflowId={id!}
                  outgoing={transitions.filter((item) => item.from_stage_id === stage.id)}
                  stages={stages}
                />
              ))}
            </ol>
          )}
        </section>

        <TransitionsPanel
          stages={stages}
          transitions={transitions}
          editable={Boolean(editable)}
          workflowId={id!}
          onAdd={() => setAddingTransition(true)}
          loading={graph.isPending}
        />
      </div>

      {workflow.data && (
        <WorkflowFormModal
          open={editing}
          onClose={() => setEditing(false)}
          record={workflow.data}
        />
      )}

      {version && (
        <>
          <PublishVersionModal
            open={publishing}
            onClose={() => setPublishing(false)}
            workflowId={id!}
            version={version}
            targetStages={stages}
          />
          <StageFormModal
            open={addingStage}
            onClose={() => setAddingStage(false)}
            workflowId={id!}
            versionId={version.id}
            nextOrder={(stages.at(-1)?.order_index ?? 0) + 10}
            isFirst={stages.length === 0}
          />
          <TransitionFormModal
            open={addingTransition}
            onClose={() => setAddingTransition(false)}
            workflowId={id!}
            versionId={version.id}
            stages={stages}
          />
        </>
      )}
    </Page>
  );
}

function VersionBar({
  versions,
  current,
  onSelect,
  loading,
}: {
  versions: VersionRead[];
  current?: VersionRead;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="mt-5 h-8 w-64" />;
  if (versions.length === 0) return null;

  return (
    <div className="mt-5 flex flex-wrap items-center gap-2">
      <span className="cap">Версия</span>
      {[...versions]
        .sort((a, b) => b.version - a.version)
        .map((version) => {
          const active = version.id === current?.id;
          return (
            <button
              key={version.id}
              type="button"
              onClick={() => onSelect(version.id)}
              aria-pressed={active}
              className={chipClass({ size: 'm', selected: active, className: 'pr-2' })}
            >
              <span className="tnum font-medium">v{version.version}</span>
              {version.published_at && (
                <span className="tnum opacity-70">{formatDate(version.published_at)}</span>
              )}
              <Badge tone={active ? 'neutral' : VERSION_TONE[version.status]} className={active ? 'bg-white/20 text-white' : ''}>
                {VERSION_LABEL[version.status]}
              </Badge>
            </button>
          );
        })}
    </div>
  );
}

function PublishVersionModal({
  open,
  onClose,
  workflowId,
  version,
  targetStages,
}: {
  open: boolean;
  onClose: () => void;
  workflowId: UUID;
  version: VersionRead;
  targetStages: StageRead[];
}) {
  const toast = useToast();
  const client = useQueryClient();
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const sourceGraph = useQuery({
    queryKey: ['workflows', workflowId, 'graph', preview?.source_version_id],
    queryFn: () => workflowsApi.versionGraph(workflowId, preview!.source_version_id!),
    enabled: Boolean(preview?.source_version_id),
  });

  const previewMutation = useMutation({
    mutationFn: () =>
      workflowsApi.migrationPreview(workflowId, version.id, {
        stage_mappings: Object.entries(mappings)
          .filter(([, toStageId]) => Boolean(toStageId))
          .map(([from_stage_id, to_stage_id]) => ({ from_stage_id, to_stage_id })),
      }),
    onSuccess: setPreview,
    onError: (error) => toast.fail(error, 'Не удалось получить последствия публикации'),
  });

  const publish = useMutation({
    mutationFn: () =>
      workflowsApi.publishWithMigration(workflowId, version.id, {
        confirm_migration: true,
        stage_mappings: Object.entries(mappings)
          .filter(([, toStageId]) => Boolean(toStageId))
          .map(([from_stage_id, to_stage_id]) => ({ from_stage_id, to_stage_id })),
      }),
    onSuccess: (published) => {
      void client.invalidateQueries({ queryKey: ['workflows'] });
      toast.notify('Версия опубликована', `Новые карточки пойдут по версии ${published.version}`);
      onClose();
    },
    onError: (error) => toast.fail(error, 'Не удалось опубликовать версию'),
  });

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setMappings({});
      return;
    }
    previewMutation.mutate();
  // A new preview is explicitly requested after mapping changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const refreshPreview = () => previewMutation.mutate();
  const unmapped = new Set(preview?.unmapped_stage_ids ?? []);
  const canPublish = preview !== null && unmapped.size === 0;
  const sourceStages = sourceGraph.data?.stages ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Опубликовать версию"
      description="Проверьте, как изменятся активные карточки, прежде чем подтвердить публикацию."
      footer={
        <>
          <Button onClick={onClose} disabled={publish.isPending}>Отмена</Button>
          <Button
            variant="primary"
            loading={publish.isPending}
            disabled={!canPublish || previewMutation.isPending}
            onClick={() => publish.mutate()}
          >
            Опубликовать
          </Button>
        </>
      }
    >
      {previewMutation.isPending && !preview ? (
        <div className="flex flex-col gap-3 py-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : preview ? (
        <div className="flex flex-col gap-4">
          <p className="text-body-m text-fg-soft">
            Затронуто активных карточек: <strong className="text-fg">{preview.affected_count}</strong>.
          </p>
          {preview.affected_count > 0 && (
            <div className="overflow-hidden rounded-m border border-line-soft">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 bg-surface-2 px-3 py-2 text-desc font-medium text-fg-muted">
                <span>Текущий этап</span><span>Этап после миграции</span>
              </div>
              <div className="max-h-64 divide-y divide-line-soft overflow-y-auto">
                {preview.affected_cards.map((item) => {
                  const from = sourceStages.find((stage) => stage.id === item.from_stage_id);
                  return (
                    <div key={item.interaction_id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 px-3 py-2">
                      <span className="truncate text-body-s text-fg">{from?.name ?? item.from_stage_id}</span>
                      <Select
                        aria-label={`Этап назначения для карточки ${item.interaction_id}`}
                        value={mappings[item.from_stage_id] ?? item.to_stage_id ?? ''}
                        placeholder="Выберите этап"
                        options={targetStages.map((stage) => ({ value: stage.id, label: stage.name }))}
                        onChange={(event) => setMappings((current) => ({
                          ...current,
                          [item.from_stage_id]: event.target.value,
                        }))}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {unmapped.size > 0 && (
            <p className="text-body-s text-error">Выберите этап назначения для всех затронутых этапов.</p>
          )}
          <Button onClick={refreshPreview} loading={previewMutation.isPending} icon="refresh">
            Обновить предпросмотр
          </Button>
        </div>
      ) : null}
    </Modal>
  );
}

function StageDeleteModal({
  open,
  onClose,
  stage,
  stages,
  workflowId,
}: {
  open: boolean;
  onClose: () => void;
  stage: StageRead;
  stages: StageRead[];
  workflowId: UUID;
}) {
  const toast = useToast();
  const client = useQueryClient();
  const [targetStageId, setTargetStageId] = useState('');
  const preview = useMutation({
    mutationFn: () => stagesApi.deletePreview(stage.id),
    onSuccess: (result) => setTargetStageId(result.suggested_target_stage_id ?? ''),
    onError: (error) => toast.fail(error, 'Не удалось получить последствия удаления'),
  });
  const remove = useMutation({
    mutationFn: () => stagesApi.remove(stage.id, { target_stage_id: targetStageId, confirm: true }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['workflows', workflowId] });
      toast.notify('Этап удалён');
      onClose();
    },
    onError: (error) => toast.fail(error, 'Не удалось удалить этап'),
  });

  useEffect(() => {
    if (open) preview.mutate();
  // The preview is always fetched afresh when the dialog opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stage.id]);

  const alternatives = stages.filter((candidate) => candidate.id !== stage.id);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Удалить этап"
      description="Карточки на этом этапе будут переведены в выбранный этап одной операцией."
      footer={
        <>
          <Button onClick={onClose} disabled={remove.isPending}>Отмена</Button>
          <Button variant="danger" loading={remove.isPending} disabled={!targetStageId} onClick={() => remove.mutate()}>
            Удалить этап
          </Button>
        </>
      }
    >
      {preview.isPending ? <Skeleton className="h-12 w-full" /> : (
        <div className="flex flex-col gap-4">
          <p className="text-body-m text-fg-soft">
            Будет переведено карточек: <strong className="text-fg">{preview.data?.affected_count ?? 0}</strong>.
          </p>
          <Select
            label="Этап назначения"
            value={targetStageId}
            required
            options={alternatives.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
            onChange={(event) => setTargetStageId(event.target.value)}
          />
        </div>
      )}
    </Modal>
  );
}

function StageRow({
  stage,
  index,
  last,
  cards,
  editable,
  renamable,
  workflowId,
  outgoing,
  stages,
}: {
  stage: StageRead;
  index: number;
  last: boolean;
  cards: number;
  editable: boolean;
  renamable: boolean;
  workflowId: string;
  outgoing: TransitionRead[];
  stages: StageRead[];
}) {
  const [renaming, setRenaming] = useState(false);
  const [removing, setRemoving] = useState(false);

  const shortcuts = outgoing
    .map((transition) => ({
      transition,
      to: stages.find((candidate) => candidate.id === transition.to_stage_id),
    }))
    .filter(({ to }) => to && Math.abs(stages.indexOf(to) - index) > 1);

  return (
    <li className="group relative grid grid-cols-[22px_1fr] gap-x-3">
      <div className="relative flex justify-center">
        {!last && (
          <span
            aria-hidden="true"
            className="absolute top-[14px] bottom-0 w-[2px] bg-line-soft"
          />
        )}
        <span
          className={
            'relative z-10 mt-1.5 size-3 rounded-full border-2 bg-card ' +
            (stage.is_initial
              ? 'border-s01'
              : stage.is_final_success
                ? 'border-success'
                : 'border-line-soft')
          }
        />
      </div>

      <div className="min-w-0 pb-4">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {stage.code && (
            <span className="whitespace-nowrap text-desc tnum text-fg-muted">
              {stage.code}
            </span>
          )}
          <span className="text-body-s text-fg">{stage.name}</span>

          {stage.is_initial && <Badge tone="s01">старт</Badge>}
          {stage.is_final_success && <Badge tone="success">успешное завершение</Badge>}
          {stage.is_terminal && !stage.is_final_success && <Badge>тупик</Badge>}
          {cards > 0 && (
            <Badge tone="info">
              {cards} карт.
            </Badge>
          )}

          {(editable || renamable) && (
            <span className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              {renamable && (
                <IconButton
                  icon="edit"
                  label={`Изменить этап ${stage.name}`}
                  size="m"
                  onClick={() => setRenaming(true)}
                />
              )}
              {editable && (
                <IconButton
                  icon="trash"
                  label={`Удалить этап ${stage.name}`}
                  size="m"
                  onClick={() => setRemoving(true)}
                />
              )}
            </span>
          )}
        </div>

        {stage.description && (
          <p className="mt-1 text-desc text-fg-muted">{stage.description}</p>
        )}

        {shortcuts.map(({ transition, to }) => (
          <p
            key={transition.id}
            className="mt-1 inline-flex items-center gap-1.5 text-desc text-fg-muted"
          >
            <Icon name="go" className="size-3 shrink-0" />
            {transition.name ?? 'Переход'} → {to!.code ?? to!.name}
          </p>
        ))}
      </div>

      {renaming && (
        <StageEditModal
          stage={stage}
          workflowId={workflowId}
          allowStructure={editable}
          onClose={() => setRenaming(false)}
        />
      )}

      <StageDeleteModal
        open={removing}
        onClose={() => setRemoving(false)}
        stage={stage}
        stages={stages}
        workflowId={workflowId}
      />
    </li>
  );
}

function StageEditModal({
  stage,
  workflowId,
  allowStructure,
  onClose,
}: {
  stage: StageRead;
  workflowId: string;
  allowStructure: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const client = useQueryClient();
  const [name, setName] = useState(stage.name);
  const [description, setDescription] = useState(stage.description ?? '');
  const [code, setCode] = useState(stage.code ?? '');
  const [isInitial, setIsInitial] = useState(stage.is_initial);
  const [isTerminal, setIsTerminal] = useState(stage.is_terminal);
  const [isFinalSuccess, setIsFinalSuccess] = useState(stage.is_final_success);
  const [confirmRename, setConfirmRename] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      // The API splits a stage's wording from its structure: renaming is allowed
      // on a published version, structural edits only in a draft.
      await stagesApi.rename(stage.id, {
        name: name.trim(),
        description: description.trim() || null,
        confirm: allowStructure ? undefined : confirmRename,
      });
      if (allowStructure) {
        await stagesApi.updateStructure(stage.id, {
          code: code.trim() || null,
          is_initial: isInitial,
          is_terminal: isTerminal,
          is_final_success: isFinalSuccess,
        });
      }
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['workflows', workflowId] });
      toast.notify('Этап сохранён');
      onClose();
    },
    onError: (error) => toast.fail(error, 'Не удалось сохранить этап'),
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Изменить этап"
      description="Название видно во всех карточках, которые стоят на этом шаге"
      footer={
        <>
          <Button onClick={onClose} disabled={save.isPending}>
            Отмена
          </Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={name.trim().length === 0 || (!allowStructure && !confirmRename)}
            onClick={() => save.mutate()}
          >
            Сохранить
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextInput
          label="Название"
          required
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        {allowStructure && (
          <TextInput
            label="Код"
            mono
            placeholder="WF-07"
            hint="Короткая метка для таблиц и отчётов"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        )}
        <TextArea
          label="Описание"
          rows={2}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        {!allowStructure && (
          <Checkbox
            label="Подтверждаю переименование опубликованного этапа"
            hint="Новое название будет видно во всех карточках на этом этапе"
            checked={confirmRename}
            onChange={(event) => setConfirmRename(event.target.checked)}
          />
        )}
        {allowStructure && <div className="flex flex-col gap-3 pt-2">
          <p className="text-h4 font-bold text-fg">Роль этапа в маршруте</p>
          <Checkbox
            label="Начальный"
            hint="С него стартуют новые карточки"
            checked={isInitial}
            onChange={(event) => setIsInitial(event.target.checked)}
          />
          <Checkbox
            label="Завершающий"
            hint="С этого этапа дальше идти некуда"
            checked={isTerminal}
            onChange={(event) => setIsTerminal(event.target.checked)}
          />
          <Checkbox
            label="Успешное завершение"
            hint="Карточка дошла до результата"
            checked={isFinalSuccess}
            onChange={(event) => setIsFinalSuccess(event.target.checked)}
          />
        </div>}
      </div>
    </Modal>
  );
}

function StageFormModal({
  open,
  onClose,
  workflowId,
  versionId,
  nextOrder,
  isFirst,
}: {
  open: boolean;
  onClose: () => void;
  workflowId: string;
  versionId: string;
  nextOrder: number;
  isFirst: boolean;
}) {
  const toast = useToast();
  const client = useQueryClient();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');

  const save = useMutation({
    mutationFn: () =>
      workflowsApi.addStage(workflowId, versionId, {
        name: name.trim(),
        code: code.trim() || null,
        description: description.trim() || null,
        order_index: nextOrder,
        is_initial: isFirst,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['workflows', workflowId] });
      toast.notify('Этап добавлен');
      setName('');
      setCode('');
      setDescription('');
      onClose();
    },
    onError: (error) => toast.fail(error, 'Не удалось добавить этап'),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новый этап"
      description="Встанет в конец маршрута — порядок можно поменять позже"
      footer={
        <>
          <Button onClick={onClose} disabled={save.isPending}>
            Отмена
          </Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={name.trim().length === 0}
            onClick={() => save.mutate()}
          >
            Добавить этап
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextInput
          label="Название"
          required
          autoFocus
          placeholder="Согласование с кафедрой"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextInput
          label="Код"
          mono
          placeholder="WF-15"
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
        <TextArea
          label="Описание"
          rows={2}
          placeholder="Что должно произойти на этом шаге"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>
    </Modal>
  );
}

function TransitionsPanel({
  stages,
  transitions,
  editable,
  workflowId,
  onAdd,
  loading,
}: {
  stages: StageRead[];
  transitions: TransitionRead[];
  editable: boolean;
  workflowId: string;
  onAdd: () => void;
  loading: boolean;
}) {
  const toast = useToast();
  const client = useQueryClient();
  const [removing, setRemoving] = useState<TransitionRead | null>(null);
  const label = (stageId: string) => {
    const stage = stages.find((candidate) => candidate.id === stageId);
    return stage ? (stage.code ?? stage.name) : '—';
  };

  // Insertion order is meaningless to a reader; route order is what they scan by.
  const order = new Map(stages.map((stage, index) => [stage.id, index]));
  const ordered = [...transitions].sort(
    (a, b) =>
      (order.get(a.from_stage_id) ?? 0) - (order.get(b.from_stage_id) ?? 0) ||
      (order.get(a.to_stage_id) ?? 0) - (order.get(b.to_stage_id) ?? 0),
  );

  const remove = useMutation({
    mutationFn: () => transitionsApi.remove(removing!.id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['workflows', workflowId] });
      toast.notify('Переход удалён');
      setRemoving(null);
    },
    onError: (error) => toast.fail(error, 'Не удалось удалить переход'),
  });

  return (
    <section className="card overflow-hidden">
      <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 sm:px-7 sm:pt-7">
        <div>
          <h2 className="card-title">Переходы</h2>
          <p className="card-sub mt-1.5">Куда можно перевести карточку с этапа</p>
        </div>
        {editable && (
          <Button size="m" icon="plus" onClick={onAdd}>
            Добавить
          </Button>
        )}
      </header>

      {loading ? (
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-8" />
          ))}
        </div>
      ) : ordered.length === 0 ? (
        <EmptyState
          compact
          icon="arrowRight"
          title="Переходов нет"
          message="Без переходов карточка останется на первом этапе."
          action={editable && <Button icon="plus" onClick={onAdd}>Добавить переход</Button>}
        />
      ) : (
        <ul className="flex max-h-[32rem] flex-col overflow-y-auto px-3 pb-3 sm:px-5 sm:pb-5">
          {ordered.map((transition) => (
            <li key={transition.id} className="group flex items-center gap-2 rounded-l px-2 py-2 transition-colors hover:bg-surface-3">
              <span className="tnum shrink-0 text-body-s text-fg-muted">
                {label(transition.from_stage_id)}
              </span>
              <Icon name="arrowRight" className="size-3.5 shrink-0 text-fg-muted" />
              <span className="tnum shrink-0 text-body-s font-medium text-s01 dark:text-s01-200">
                {label(transition.to_stage_id)}
              </span>
              <span className="min-w-0 flex-1 truncate text-body-s text-fg-soft">
                {transition.name ?? ''}
              </span>
              {transition.requires_comment && (
                <span title="Требует комментария при переходе" className="shrink-0 text-fg-muted">
                  <Icon name="comment" className="size-3.5" />
                </span>
              )}
              {editable && (
                <IconButton
                  icon="trash"
                  label="Удалить переход"
                  size="m"
                  className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => setRemoving(transition)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmModal
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        danger
        title="Удалить переход?"
        confirmLabel="Удалить"
        message={
          removing ? (
            <>
              Переход {label(removing.from_stage_id)} → {label(removing.to_stage_id)} исчезнет из
              черновика.
            </>
          ) : null
        }
      />
    </section>
  );
}

function TransitionFormModal({
  open,
  onClose,
  workflowId,
  versionId,
  stages,
}: {
  open: boolean;
  onClose: () => void;
  workflowId: string;
  versionId: string;
  stages: StageRead[];
}) {
  const toast = useToast();
  const client = useQueryClient();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [name, setName] = useState('');
  const [requiresComment, setRequiresComment] = useState(true);

  const options = stages.map((stage) => ({
    value: stage.id,
    label: `${stage.code ? stage.code + ' · ' : ''}${stage.name}`,
  }));

  const save = useMutation({
    mutationFn: () =>
      workflowsApi.addTransition(workflowId, versionId, {
        from_stage_id: from,
        to_stage_id: to,
        name: name.trim() || null,
        requires_comment: requiresComment,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['workflows', workflowId] });
      toast.notify('Переход добавлен');
      setFrom('');
      setTo('');
      setName('');
      onClose();
    },
    onError: (error) => toast.fail(error, 'Не удалось добавить переход'),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новый переход"
      description="Разрешает перевести карточку с одного этапа на другой"
      footer={
        <>
          <Button onClick={onClose} disabled={save.isPending}>
            Отмена
          </Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={!from || !to || from === to}
            onClick={() => save.mutate()}
          >
            Добавить переход
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select
          label="С этапа"
          required
          placeholder="Выберите этап"
          options={options}
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
        <Select
          label="На этап"
          required
          placeholder="Выберите этап"
          options={options.filter((option) => option.value !== from)}
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
        <TextInput
          label="Название действия"
          placeholder="Дальше"
          hint="Так кнопка будет подписана в карточке"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Checkbox
          label="Требовать комментарий"
          hint="Пользователь не сможет перевести карточку молча"
          checked={requiresComment}
          onChange={(event) => setRequiresComment(event.target.checked)}
        />
      </div>
    </Modal>
  );
}
