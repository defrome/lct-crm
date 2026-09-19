// oxlint-disable react/set-state-in-effect
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { ApiError } from '@/api/client';
import { interactionsApi } from '@/api/endpoints';
import type { InteractionCreate, InteractionRead } from '@/api/types';
import { useWorkflows } from '@/api/queries';
import { useToast } from '@/app/ToastProvider';
import {
  DirectionPicker,
  ProductPicker,
  UniversityPicker,
  UserPicker,
} from '@/components/pickers/EntityPickers';
import { Button } from '@/components/ui/Button';
import { Select, TextArea, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { formatDate } from '@/lib/format';

type FormState = {
  university_id: string | null;
  counterparty_group: 'b2b' | 'b2c';
  workflow_id: string | null;
  it_direction_id: string | null;
  it_product_id: string | null;
  responsible_user_id: string | null;
  contract_number: string;
  license_signed_at: string;
  license_years: string;
  license_expires_at: string;
  transfer_status: string;
  comment: string;
};

const EMPTY: FormState = {
  university_id: null,
  counterparty_group: 'b2b',
  workflow_id: null,
  it_direction_id: null,
  it_product_id: null,
  responsible_user_id: null,
  contract_number: '',
  license_signed_at: '',
  license_years: '',
  license_expires_at: '',
  transfer_status: '',
  comment: '',
};

function fromRecord(record: InteractionRead): FormState {
  return {
    university_id: record.university_id,
    counterparty_group: record.counterparty_group,
    workflow_id: null,
    it_direction_id: record.it_direction_id,
    it_product_id: record.it_product_id,
    responsible_user_id: record.responsible_user_id,
    contract_number: record.contract_number ?? '',
    license_signed_at: record.license_signed_at ?? '',
    license_years: record.license_years ? String(record.license_years) : '',
    license_expires_at: record.license_expires_at ?? '',
    transfer_status: record.transfer_status ?? '',
    comment: record.comment ?? '',
  };
}

/** The date the server would compute from «подписано + срок», shown before saving. */
function derivedExpiry(signedAt: string, years: string): string | null {
  if (!signedAt || !years) return null;
  const date = new Date(signedAt);
  if (Number.isNaN(date.getTime())) return null;
  date.setFullYear(date.getFullYear() + Number(years));
  return date.toISOString().slice(0, 10);
}

export function InteractionFormModal({
  open,
  onClose,
  record,
  onCreated,
  /** Pre-selects a university when the card is created from that university's page. */
  universityId,
}: {
  open: boolean;
  onClose: () => void;
  record?: InteractionRead;
  onCreated?: (created: InteractionRead) => void;
  universityId?: string;
}) {
  const toast = useToast();
  const client = useQueryClient();
  const workflows = useWorkflows({ size: 200 });
  const [form, setForm] = useState<FormState>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    if (!open) return;
    setForm(record ? fromRecord(record) : { ...EMPTY, university_id: universityId ?? null });
    setFieldErrors({});
  }, [open, record, universityId]);

  const patch = (changes: Partial<FormState>) => setForm((current) => ({ ...current, ...changes }));

  const mutation = useMutation({
    mutationFn: async () => {
      const body: InteractionCreate = {
        university_id: form.university_id!,
        counterparty_group: form.counterparty_group,
        workflow_id: form.workflow_id,
        it_direction_id: form.it_direction_id,
        it_product_id: form.it_product_id,
        responsible_user_id: form.responsible_user_id,
        contract_number: form.contract_number.trim() || null,
        license_signed_at: form.license_signed_at || null,
        license_years: form.license_years ? Number(form.license_years) : null,
        license_expires_at: form.license_expires_at || null,
        transfer_status: form.transfer_status.trim() || null,
        comment: form.comment.trim() || null,
      };
      if (record) {
        const { counterparty_group: _group, workflow_id: _workflow, ...update } = body;
        return interactionsApi.update(record.id, update);
      }
      return interactionsApi.create(body);
    },
    onSuccess: (saved) => {
      void client.invalidateQueries({ queryKey: ['interactions'] });
      toast.notify(record ? 'Карточка сохранена' : 'Карточка создана');
      onClose();
      if (!record) onCreated?.(saved);
    },
    onError: (error) => {
      if (error instanceof ApiError) setFieldErrors(error.fieldErrors);
      toast.fail(error, record ? 'Не удалось сохранить карточку' : 'Не удалось создать карточку');
    },
  });

  const expiry = derivedExpiry(form.license_signed_at, form.license_years);
  const availableWorkflows = (workflows.data?.items ?? []).filter(
    (workflow) =>
      workflow.is_active &&
      workflow.counterparty_group === form.counterparty_group,
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={record ? 'Изменить карточку' : 'Новая карточка взаимодействия'}
      description="Связка «вуз + ИТ-направление + ИТ-продукт» и её договор"
      footer={
        <>
          <Button onClick={onClose} disabled={mutation.isPending}>
            Отмена
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            disabled={!form.university_id}
            onClick={() => mutation.mutate()}
          >
            {record ? 'Сохранить' : 'Создать карточку'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <UniversityPicker
          className="sm:col-span-2"
          label="Вуз"
          required
          value={form.university_id}
          onChange={(value) => patch({ university_id: value })}
          error={fieldErrors.university_id}
        />
        {!record && (
          <>
            <Select
              label="Группа контрагента"
              value={form.counterparty_group}
              options={[
                { value: 'b2b', label: 'B2B' },
                { value: 'b2c', label: 'B2C' },
              ]}
              onChange={(event) => patch({
                counterparty_group: event.target.value as 'b2b' | 'b2c',
                workflow_id: null,
              })}
            />
            <Select
              label="Маршрут"
              value={form.workflow_id ?? ''}
              placeholder={
                workflows.isPending
                  ? 'Загрузка маршрутов…'
                  : 'По умолчанию для группы'
              }
              options={availableWorkflows.map((workflow) => ({
                value: workflow.id,
                label: `${workflow.name}${workflow.is_default ? ' (по умолчанию)' : ''}`,
              }))}
              disabled={workflows.isPending}
              onChange={(event) => patch({ workflow_id: event.target.value || null })}
              hint="Карточка сразу начнёт путь по опубликованной версии выбранного маршрута"
              error={fieldErrors.workflow_id}
            />
          </>
        )}
        <DirectionPicker
          label="ИТ-направление"
          value={form.it_direction_id}
          onChange={(value) => patch({ it_direction_id: value })}
          error={fieldErrors.it_direction_id}
        />
        <ProductPicker
          label="ИТ-продукт"
          value={form.it_product_id}
          onChange={(value) => patch({ it_product_id: value })}
          error={fieldErrors.it_product_id}
        />

        <div className="sm:col-span-2 pt-4">
          <p className="text-h4 font-bold text-fg mb-4">Договор и лицензия</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextInput
              label="Номер договора"
              mono
              placeholder="ДЛ-2026/114"
              value={form.contract_number}
              onChange={(event) => patch({ contract_number: event.target.value })}
              error={fieldErrors.contract_number}
            />
            <TextInput
              label="Подписание лицензии"
              type="date"
              value={form.license_signed_at}
              onChange={(event) => patch({ license_signed_at: event.target.value })}
              error={fieldErrors.license_signed_at}
            />
            <TextInput
              label="Срок, лет"
              type="number"
              min={1}
              max={10}
              placeholder="3"
              value={form.license_years}
              onChange={(event) => patch({ license_years: event.target.value })}
              error={fieldErrors.license_years}
              hint={expiry && !form.license_expires_at ? `Истечёт ${formatDate(expiry)}` : undefined}
            />
          </div>
          <TextInput
            className="mt-4"
            label="Дата окончания лицензии"
            type="date"
            value={form.license_expires_at}
            onChange={(event) => patch({ license_expires_at: event.target.value })}
            hint="Оставьте пустым — посчитается по дате подписания и сроку"
            error={fieldErrors.license_expires_at}
          />
        </div>

        <div className="sm:col-span-2 pt-4">
          <p className="text-h4 font-bold text-fg mb-4">Работа по карточке</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <UserPicker
              label="Ответственный КАМ"
              value={form.responsible_user_id}
              onChange={(value) => patch({ responsible_user_id: value })}
              error={fieldErrors.responsible_user_id}
            />
            <TextInput
              label="Статус по передаче"
              placeholder="Передано в вуз"
              value={form.transfer_status}
              onChange={(event) => patch({ transfer_status: event.target.value })}
              hint="Текст из каталога; этап маршрута задаётся отдельно"
              error={fieldErrors.transfer_status}
            />
          </div>
          <TextArea
            className="mt-4"
            label="Комментарий"
            placeholder="Что важно помнить команде по этой карточке"
            value={form.comment}
            onChange={(event) => patch({ comment: event.target.value })}
            error={fieldErrors.comment}
          />
        </div>
      </div>
    </Modal>
  );
}
