import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { assignmentsApi, contactsApi, universitiesApi } from '@/api/endpoints';
import {
  useInteractions,
  useUniversity,
  useUniversityAssignments,
  useUniversityContacts,
} from '@/api/queries';
import type { AssignmentRead, ContactRead } from '@/api/types';
import { useAuth } from '@/app/AuthProvider';
import { useToast } from '@/app/ToastProvider';
import { Page } from '@/components/layout/AppShell';
import { UserPicker } from '@/components/pickers/EntityPickers';
import { Badge } from '@/components/ui/Badge';
import { Button, IconButton } from '@/components/ui/Button';
import { Checkbox, TextInput } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { ConfirmModal, Modal } from '@/components/ui/Modal';
import { Blank, DataRow, EmptyState, ErrorState, PageHeader, Skeleton } from '@/components/ui/States';
import { InteractionFormModal } from '@/features/interactions/InteractionFormModal';
import { LicenseDate, StageChip } from '@/features/interactions/parts';
import { useStageLookup } from '@/features/workflows/useStageLookup';
import { formatDate, shortName, today } from '@/lib/format';
import { UniversityFormModal } from './UniversityFormModal';

export function UniversityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const client = useQueryClient();
  const { can } = useAuth();
  const stages = useStageLookup();

  const university = useUniversity(id);
  const contacts = useUniversityContacts(id);
  const assignments = useUniversityAssignments(id);
  const cards = useInteractions({ university_id: id, size: 100, sort: '-updated_at' });

  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [addingCard, setAddingCard] = useState(false);

  const remove = useMutation({
    mutationFn: () => universitiesApi.remove(id!),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['universities'] });
      toast.notify('Вуз удалён');
      navigate('/universities');
    },
    onError: (error) => toast.fail(error, 'Не удалось удалить вуз'),
  });

  if (university.error) {
    return (
      <Page>
        <ErrorState error={university.error} onRetry={() => void university.refetch()} />
      </Page>
    );
  }

  const record = university.data;
  const activeAssignment = (assignments.data?.items ?? []).find(
    (assignment) => assignment.assigned_to === null,
  );

  return (
    <Page>

      <PageHeader
        back={{ to: '/universities', label: 'Все вузы' }}
        eyebrow="Вуз"
        title={record ? (record.short_name ?? record.name) : <Skeleton className="h-7 w-72" />}
        meta={
          record && (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {record.short_name && <span>{record.name}</span>}
              {record.region && <span>{record.region}</span>}
              {activeAssignment?.user && (
                <span className="inline-flex items-center gap-1">
                  <Icon name="users" className="size-3.5" />
                  КАМ: {shortName(activeAssignment.user.full_name)}
                </span>
              )}
            </span>
          )
        }
        actions={
          record &&
          can('manager') && (
            <>
              <Button icon="plus" onClick={() => setAddingCard(true)}>
                Новая карточка
              </Button>
              <Button icon="edit" onClick={() => setEditing(true)}>
                Изменить
              </Button>
              {can('admin') && (
                <IconButton icon="trash" label="Удалить вуз" onClick={() => setDeleting(true)} />
              )}
            </>
          )
        }
      />

      <div className="mt-6 grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-4">
          <section className="card overflow-hidden">
            <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 sm:px-7 sm:pt-7">
              <h2 className="card-title">Взаимодействия</h2>
              <Badge>{cards.data?.total ?? 0}</Badge>
            </header>

            {cards.isPending ? (
              <div className="flex flex-col gap-2 p-4">
                {Array.from({ length: 3 }, (_, index) => (
                  <Skeleton key={index} className="h-10" />
                ))}
              </div>
            ) : (cards.data?.items.length ?? 0) === 0 ? (
              <EmptyState
                compact
                icon="cards"
                title="Карточек по этому вузу нет"
                message="Заведите первую связку «направление + продукт»."
                action={
                  can('manager') && (
                    <Button icon="plus" onClick={() => setAddingCard(true)}>
                      Новая карточка
                    </Button>
                  )
                }
              />
            ) : (
              <ul className="flex flex-col px-3 pb-3 sm:px-5 sm:pb-5">
                {cards.data!.items.map((card) => (
                  <li key={card.id}>
                    <Link
                      to={`/interactions/${card.id}`}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-l px-2 py-2.5 transition-colors hover:bg-surface-3"
                    >
                      <span className="min-w-0 flex-1 basis-56">
                        <span className="block truncate text-body-s text-fg">
                          {[card.it_direction?.name, card.it_product?.name]
                            .filter(Boolean)
                            .join(' · ') || 'Направление и продукт не заданы'}
                        </span>
                        {card.contract_number && (
                          <span className="tnum block text-desc text-fg-muted">
                            {card.contract_number}
                          </span>
                        )}
                      </span>
                      <StageChip
                        className="basis-48"
                        info={
                          card.current_stage_id
                            ? stages.byStageId.get(card.current_stage_id)
                            : undefined
                        }
                        fallback={card.transfer_status}
                      />
                      <LicenseDate value={card.license_expires_at} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <ContactsSection
            universityId={id!}
            contacts={contacts.data?.items ?? []}
            loading={contacts.isPending}
            onAdd={() => setAddingContact(true)}
            canEdit={can('manager')}
          />
        </div>

        <div className="flex flex-col gap-4">
          <section className="card card-pad">
            <h2 className="card-title mb-5">Реквизиты</h2>
            {record ? (
              <dl className="flex flex-col">
                <DataRow label="Полное название">{record.name}</DataRow>
                <DataRow label="Короткое название">{record.short_name ?? <Blank />}</DataRow>
                <DataRow label="Регион">{record.region ?? <Blank />}</DataRow>
                <DataRow label="ИНН" mono>
                  {record.inn ?? <Blank />}
                </DataRow>
                <DataRow label="Внешний ID" mono>
                  {record.external_id ?? <Blank />}
                </DataRow>
              </dl>
            ) : (
              <div className="flex flex-col gap-3 py-2">
                {Array.from({ length: 5 }, (_, index) => (
                  <Skeleton key={index} className="h-4 w-full" />
                ))}
              </div>
            )}
            {record?.comment && (
              <div className="mt-4 rounded-m bg-surface-3 p-3">
                <p className="cap mb-1">Комментарий</p>
                <p className="text-body-s text-fg-soft">{record.comment}</p>
              </div>
            )}
          </section>

          <AssignmentsSection
            assignments={assignments.data?.items ?? []}
            loading={assignments.isPending}
            onAssign={() => setAssigning(true)}
            canEdit={can('manager')}
            universityId={id!}
          />
        </div>
      </div>

      {record && (
        <UniversityFormModal open={editing} onClose={() => setEditing(false)} record={record} />
      )}
      <InteractionFormModal
        open={addingCard}
        onClose={() => setAddingCard(false)}
        universityId={id}
        onCreated={(created) => navigate(`/interactions/${created.id}`)}
      />
      <ContactFormModal
        universityId={id!}
        open={addingContact}
        onClose={() => setAddingContact(false)}
      />
      <AssignModal universityId={id!} open={assigning} onClose={() => setAssigning(false)} />

      <ConfirmModal
        open={deleting}
        onClose={() => setDeleting(false)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
        danger
        title="Удалить вуз?"
        confirmLabel="Удалить"
        message="Вуз будет помечен удалённым. Карточки, контакты и назначения останутся в базе и в журнале аудита."
      />
    </Page>
  );
}

function ContactsSection({
  universityId,
  contacts,
  loading,
  onAdd,
  canEdit,
}: {
  universityId: string;
  contacts: ContactRead[];
  loading: boolean;
  onAdd: () => void;
  canEdit: boolean;
}) {
  const toast = useToast();
  const client = useQueryClient();
  const [removing, setRemoving] = useState<ContactRead | null>(null);

  const remove = useMutation({
    mutationFn: () => contactsApi.remove(removing!.id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['universities', universityId, 'contacts'] });
      toast.notify('Контакт удалён');
      setRemoving(null);
    },
    onError: (error) => toast.fail(error, 'Не удалось удалить контакт'),
  });

  return (
    <section className="card overflow-hidden">
      <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 sm:px-7 sm:pt-7">
        <h2 className="card-title">Контактные лица вуза</h2>
        {canEdit && (
          <Button size="m" icon="plus" onClick={onAdd}>
            Добавить
          </Button>
        )}
      </header>

      {loading ? (
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="h-10" />
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <EmptyState
          compact
          icon="users"
          title="Контактов пока нет"
          message="Добавьте, с кем в вузе вы общаетесь."
          action={canEdit && <Button icon="plus" onClick={onAdd}>Добавить контакт</Button>}
        />
      ) : (
        <ul className="flex flex-col px-3 pb-3 sm:px-5 sm:pb-5">
          {contacts.map((contact) => (
            <li key={contact.id} className="flex items-center gap-3 rounded-l px-2 py-2.5 transition-colors hover:bg-surface-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-body-s text-fg">
                  {contact.full_name}
                  {contact.is_primary && (
                    <Badge tone="s01">
                      <Icon name="flag" className="size-3.5" />
                      основной
                    </Badge>
                  )}
                </p>
                {contact.position && (
                  <p className="text-desc text-fg-muted">{contact.position}</p>
                )}
                <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-desc">
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="inline-flex items-center gap-1 text-accent transition-colors hover:underline"
                    >
                      <Icon name="mail" className="size-3" />
                      {contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <a
                      href={`tel:${contact.phone}`}
                      className="inline-flex items-center gap-1 text-accent transition-colors hover:underline"
                    >
                      <Icon name="phone" className="size-3" />
                      {contact.phone}
                    </a>
                  )}
                </p>
              </div>
              {canEdit && (
                <IconButton
                  icon="trash"
                  label={`Удалить контакт ${contact.full_name}`}
                  size="m"
                  onClick={() => setRemoving(contact)}
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
        title="Удалить контакт?"
        confirmLabel="Удалить"
        message={`«${removing?.full_name}» перестанет отображаться в карточке вуза.`}
      />
    </section>
  );
}

function AssignmentsSection({
  assignments,
  loading,
  onAssign,
  canEdit,
  universityId,
}: {
  assignments: AssignmentRead[];
  loading: boolean;
  onAssign: () => void;
  canEdit: boolean;
  universityId: string;
}) {
  const toast = useToast();
  const client = useQueryClient();
  const [closing, setClosing] = useState<AssignmentRead | null>(null);

  const close = useMutation({
    mutationFn: () => assignmentsApi.close(closing!.id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['universities', universityId, 'assignments'] });
      toast.notify('Назначение закрыто', 'Датой закрытия проставлен сегодняшний день');
      setClosing(null);
    },
    onError: (error) => toast.fail(error, 'Не удалось закрыть назначение'),
  });

  return (
    <section className="card overflow-hidden">
      <header className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 sm:px-7 sm:pt-7">
        <h2 className="card-title">Закрепление КАМов</h2>
        {canEdit && (
          <Button size="m" icon="plus" onClick={onAssign}>
            Назначить
          </Button>
        )}
      </header>

      {loading ? (
        <div className="flex flex-col gap-2 p-4">
          <Skeleton className="h-10" />
        </div>
      ) : assignments.length === 0 ? (
        <EmptyState
          compact
          icon="target"
          title="Ответственный не назначен"
          message="КАМ видит только закреплённые за собой вузы."
          action={canEdit && <Button icon="plus" onClick={onAssign}>Назначить КАМа</Button>}
        />
      ) : (
        <ul className="flex flex-col px-3 pb-3 sm:px-5 sm:pb-5">
          {assignments.map((assignment) => {
            const active = assignment.assigned_to === null;
            return (
              <li key={assignment.id} className="flex items-center gap-3 rounded-l px-2 py-2.5 transition-colors hover:bg-surface-3">
                <span
                  aria-hidden="true"
                  className={
                    'size-1.5 shrink-0 rounded-full ' + (active ? 'bg-success' : 'bg-line-soft')
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-s text-fg">
                    {assignment.user?.full_name ?? 'Сотрудник удалён'}
                  </p>
                  <p className="tnum text-desc text-fg-muted">
                    {formatDate(assignment.assigned_from)} —{' '}
                    {active ? 'сейчас' : formatDate(assignment.assigned_to)}
                  </p>
                </div>
                {active && canEdit && (
                  <Button size="m" onClick={() => setClosing(assignment)}>
                    Закрыть
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmModal
        open={Boolean(closing)}
        onClose={() => setClosing(null)}
        onConfirm={() => close.mutate()}
        loading={close.isPending}
        title="Закрыть назначение?"
        confirmLabel="Закрыть назначение"
        message={
          <>
            «{closing?.user?.full_name}» перестанет отвечать за этот вуз с сегодняшнего дня. Запись
            останется в истории.
          </>
        }
      />
    </section>
  );
}

function ContactFormModal({
  universityId,
  open,
  onClose,
}: {
  universityId: string;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const client = useQueryClient();
  const [form, setForm] = useState({
    full_name: '',
    position: '',
    email: '',
    phone: '',
    is_primary: false,
  });

  const save = useMutation({
    mutationFn: () =>
      universitiesApi.addContact(universityId, {
        full_name: form.full_name.trim(),
        position: form.position.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        is_primary: form.is_primary,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['universities', universityId, 'contacts'] });
      toast.notify('Контакт добавлен');
      setForm({ full_name: '', position: '', email: '', phone: '', is_primary: false });
      onClose();
    },
    onError: (error) => toast.fail(error, 'Не удалось добавить контакт'),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Контактное лицо вуза"
      description="Персональные данные: их просмотр записывается в журнал аудита"
      footer={
        <>
          <Button onClick={onClose} disabled={save.isPending}>
            Отмена
          </Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={form.full_name.trim().length === 0}
            onClick={() => save.mutate()}
          >
            Добавить
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          className="sm:col-span-2"
          label="ФИО"
          required
          autoFocus
          placeholder="Соколова Анна Викторовна"
          value={form.full_name}
          onChange={(event) => setForm({ ...form, full_name: event.target.value })}
        />
        <TextInput
          className="sm:col-span-2"
          label="Должность"
          placeholder="Начальник учебного управления"
          value={form.position}
          onChange={(event) => setForm({ ...form, position: event.target.value })}
        />
        <TextInput
          label="Рабочий email"
          type="email"
          value={form.email}
          onChange={(event) => setForm({ ...form, email: event.target.value })}
        />
        <TextInput
          label="Рабочий телефон"
          type="tel"
          value={form.phone}
          onChange={(event) => setForm({ ...form, phone: event.target.value })}
        />
        <Checkbox
          className="sm:col-span-2"
          label="Основной контакт"
          hint="К кому обращаться в первую очередь"
          checked={form.is_primary}
          onChange={(event) => setForm({ ...form, is_primary: event.target.checked })}
        />
      </div>
    </Modal>
  );
}

function AssignModal({
  universityId,
  open,
  onClose,
}: {
  universityId: string;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const client = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState('');

  const save = useMutation({
    mutationFn: () =>
      universitiesApi.assign(universityId, {
        user_id: userId!,
        assigned_from: from,
        assigned_to: to || null,
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['universities', universityId, 'assignments'] });
      toast.notify('Ответственный назначен');
      setUserId(null);
      setTo('');
      onClose();
    },
    onError: (error) => toast.fail(error, 'Не удалось назначить ответственного'),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Назначить ответственного"
      description="У вуза не может быть двух активных КАМов с пересекающимися периодами"
      footer={
        <>
          <Button onClick={onClose} disabled={save.isPending}>
            Отмена
          </Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={!userId || !from}
            onClick={() => save.mutate()}
          >
            Назначить
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <UserPicker
          className="sm:col-span-2"
          label="КАМ"
          required
          value={userId}
          onChange={setUserId}
        />
        <TextInput
          label="Отвечает с"
          type="date"
          required
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
        <TextInput
          label="По"
          type="date"
          hint="Пусто — бессрочно"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
      </div>
    </Modal>
  );
}
