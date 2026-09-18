// oxlint-disable react/set-state-in-effect
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { ApiError } from '@/api/client';
import { universitiesApi } from '@/api/endpoints';
import type { UniversityRead } from '@/api/types';
import { useToast } from '@/app/ToastProvider';
import { Button } from '@/components/ui/Button';
import { TextArea, TextInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';

interface FormState {
  name: string;
  short_name: string;
  region: string;
  inn: string;
  external_id: string;
  comment: string;
}

const EMPTY: FormState = {
  name: '',
  short_name: '',
  region: '',
  inn: '',
  external_id: '',
  comment: '',
};

export function UniversityFormModal({
  open,
  onClose,
  record,
  initialName,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  record?: UniversityRead;
  /** Pre-fills the name when the dialog is opened from a picker's «создать». */
  initialName?: string;
  onCreated?: (created: UniversityRead) => void;
}) {
  const toast = useToast();
  const client = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    if (!open) return;
    setForm(
      record
        ? {
            name: record.name,
            short_name: record.short_name ?? '',
            region: record.region ?? '',
            inn: record.inn ?? '',
            external_id: record.external_id ?? '',
            comment: record.comment ?? '',
          }
        : { ...EMPTY, name: initialName ?? '' },
    );
    setFieldErrors({});
  }, [open, record, initialName]);

  const patch = (changes: Partial<FormState>) => setForm((current) => ({ ...current, ...changes }));

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        short_name: form.short_name.trim() || null,
        region: form.region.trim() || null,
        inn: form.inn.trim() || null,
        external_id: form.external_id.trim() || null,
        comment: form.comment.trim() || null,
      };
      return record ? universitiesApi.update(record.id, body) : universitiesApi.create(body);
    },
    onSuccess: (saved) => {
      void client.invalidateQueries({ queryKey: ['universities'] });
      toast.notify(record ? 'Вуз сохранён' : 'Вуз создан', saved.name);
      onClose();
      if (!record) onCreated?.(saved);
    },
    onError: (error) => {
      if (error instanceof ApiError) setFieldErrors(error.fieldErrors);
      toast.fail(error, record ? 'Не удалось сохранить вуз' : 'Не удалось создать вуз');
    },
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={record ? 'Изменить вуз' : 'Новый вуз'}
      description="Название должно совпадать с тем, что приходит в каталоге из Excel"
      footer={
        <>
          <Button onClick={onClose} disabled={save.isPending}>
            Отмена
          </Button>
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={form.name.trim().length === 0}
            onClick={() => save.mutate()}
          >
            {record ? 'Сохранить' : 'Создать вуз'}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          className="sm:col-span-2"
          label="Полное название"
          required
          autoFocus
          placeholder="МГТУ им. Н.Э. Баумана"
          value={form.name}
          onChange={(event) => patch({ name: event.target.value })}
          error={fieldErrors.name}
        />
        <TextInput
          label="Короткое название"
          placeholder="Бауманка"
          hint="Показывается в списках и карточках"
          value={form.short_name}
          onChange={(event) => patch({ short_name: event.target.value })}
          error={fieldErrors.short_name}
        />
        <TextInput
          label="Регион"
          placeholder="г. Москва"
          value={form.region}
          onChange={(event) => patch({ region: event.target.value })}
          error={fieldErrors.region}
        />
        <TextInput
          label="ИНН"
          mono
          inputMode="numeric"
          placeholder="7701002520"
          value={form.inn}
          onChange={(event) => patch({ inn: event.target.value })}
          error={fieldErrors.inn}
        />
        <TextInput
          label="Внешний идентификатор"
          mono
          hint="ID вуза в LMS или на сайте"
          value={form.external_id}
          onChange={(event) => patch({ external_id: event.target.value })}
          error={fieldErrors.external_id}
        />
        <TextArea
          className="sm:col-span-2"
          label="Комментарий"
          rows={2}
          value={form.comment}
          onChange={(event) => patch({ comment: event.target.value })}
          error={fieldErrors.comment}
        />
      </div>
    </Modal>
  );
}
