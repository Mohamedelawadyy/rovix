import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextArea } from '@/components/ui/TextArea';
import { isApiError } from '@/lib/api';
import { getErrorMessage } from '@/lib/api/error-message';
import { ar } from '@/locales/ar';
import { reservationKeys, reservationsApi } from '../api/reservations-api';
import { isValidReason, type Reservation } from '../types';

const t = ar.reservations.release;

export function ReleaseReservationDialog({
  reservation,
  onClose,
  onDone,
}: {
  reservation: Reservation;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const mutation = useMutation({
    mutationFn: () => reservationsApi.release(reservation.id, reason.trim()),
    onSuccess: async (updated) => {
      queryClient.setQueryData(reservationKeys.detail(updated.id), updated);
      // The vehicle is available again: refresh reservations and inventory.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: reservationKeys.all }),
        queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
      ]);
      onDone(t.done);
    },
  });

  const serverFieldError =
    isApiError(mutation.error) && mutation.error.kind === 'validation'
      ? mutation.error.fieldError('reason')
      : undefined;
  const formError = mutation.error && !serverFieldError ? getErrorMessage(mutation.error) : null;

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!mutation.isPending}
      title={t.title}
      description={t.body}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            {t.close}
          </Button>
          <Button
            variant="danger"
            loading={mutation.isPending}
            loadingLabel={t.working}
            onClick={() => {
              setTouched(true);
              if (isValidReason(reason)) mutation.mutate();
            }}
          >
            {t.confirm}
          </Button>
        </>
      }
    >
      {formError ? <Alert tone="danger">{formError}</Alert> : null}
      <TextArea
        label={t.reason}
        hint={t.reasonHint}
        rows={3}
        maxLength={255}
        value={reason}
        error={
          (touched && !isValidReason(reason) ? t.reasonInvalid : undefined) ?? serverFieldError
        }
        onChange={(event) => {
          setReason(event.target.value);
        }}
      />
    </Dialog>
  );
}
