import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { interactionsApi } from '@/api/endpoints';
import type { StageRead, TransitionRead } from '@/api/types';
import { useToast } from '@/app/ToastProvider';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';

/**
 * Окно перехода карточки на другой этап — общее для рельса на карточке
 * взаимодействия и для канбана: обе поверхности двигают карточку по одному и
 * тому же API и должны требовать комментарий одинаково.
 */
export function TransitionModal({
  interactionId,
  target,
  onClose,
}: {
  interactionId: string;
  target: { stage: StageRead; transition: TransitionRead } | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const client = useQueryClient();
  const [comment, setComment] = useState('');

  const move = useMutation({
    mutationFn: () =>
      interactionsApi.transition(interactionId, {
        to_stage_id: target!.stage.id,
        comment: comment.trim() || null,
      }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ['interactions'] });
      toast.notify('Карточка переведена', target!.stage.name);
      setComment('');
      onClose();
    },
    onError: (error) => toast.fail(error, 'Не удалось перевести карточку'),
  });

  const required = target?.transition.requires_comment ?? false;

  return (
    <Modal
      open={Boolean(target)}
      onClose={onClose}
      title={target?.transition.name ?? 'Перевести карточку'}
      description={
        target ? `Следующий этап: ${target.stage.code ?? ''} ${target.stage.name}`.trim() : undefined
      }
      footer={
        <>
          <Button onClick={onClose} disabled={move.isPending}>
            Отмена
          </Button>
          <Button
            variant="primary"
            loading={move.isPending}
            disabled={required && comment.trim().length === 0}
            onClick={() => move.mutate()}
          >
            Перевести
          </Button>
        </>
      }
    >
      <TextArea
        label="Комментарий"
        required={required}
        autoFocus
        rows={3}
        placeholder="Что сделано и о чём договорились"
        hint={
          required
            ? 'Этот переход требует комментария'
            : 'Появится в истории карточки — необязательно, но помогает команде'
        }
        value={comment}
        onChange={(event) => setComment(event.target.value)}
      />
    </Modal>
  );
}
