import { useState } from 'react';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useAuth } from '@/features/auth/auth-context';
import { canAccessBranch } from '@/features/auth/permissions';
import { getErrorMessage } from '@/lib/api/error-message';
import { ar, interpolate } from '@/locales/ar';
import { vehiclesApi } from '../api/vehicles-api';
import type { VehicleMovement } from '../types';
import { useVehicleMutation } from '../use-vehicle-mutation';

const t = ar.vehicles.actions;

/**
 * Receive / cancel buttons for an in-transit movement. The backend requires `vehicles.transfer`
 * plus access to the destination branch to receive, or to the source branch to cancel.
 */
export function TransferActions({
  movement,
  onDone,
}: {
  movement: VehicleMovement;
  onDone?: (message: string) => void;
}) {
  const { user, can } = useAuth();
  const [pending, setPending] = useState<'receive' | 'cancel' | null>(null);

  if (movement.status !== 'in_transit' || !can('vehicles.transfer')) return null;
  const canReceive = canAccessBranch(user, movement.to_branch?.id);
  const canCancel = canAccessBranch(user, movement.from_branch?.id);
  if (!canReceive && !canCancel) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {canReceive ? (
        <Button
          variant="primary"
          onClick={() => {
            setPending('receive');
          }}
        >
          {t.receive}
        </Button>
      ) : null}
      {canCancel ? (
        <Button
          variant="secondary"
          onClick={() => {
            setPending('cancel');
          }}
        >
          {t.cancelTransfer}
        </Button>
      ) : null}
      {pending ? (
        <ConfirmTransferDialog
          movement={movement}
          kind={pending}
          onClose={() => {
            setPending(null);
          }}
          onDone={(message) => {
            setPending(null);
            onDone?.(message);
          }}
        />
      ) : null}
    </div>
  );
}

function ConfirmTransferDialog({
  movement,
  kind,
  onClose,
  onDone,
}: {
  movement: VehicleMovement;
  kind: 'receive' | 'cancel';
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const receiving = kind === 'receive';
  const mutation = useVehicleMutation(
    () =>
      receiving
        ? vehiclesApi.receiveTransfer(movement.id)
        : vehiclesApi.cancelTransfer(movement.id),
    () => {
      onDone(receiving ? t.received : t.transferCancelled);
    },
  );
  const branches = { from: movement.from_branch?.name ?? '—', to: movement.to_branch?.name ?? '—' };

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!mutation.isPending}
      title={receiving ? t.receiveTitle : t.cancelTransferTitle}
      description={interpolate(receiving ? t.receiveBody : t.cancelTransferBody, branches)}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            {t.close}
          </Button>
          <Button
            variant={receiving ? 'primary' : 'danger'}
            loading={mutation.isPending}
            loadingLabel={t.working}
            onClick={() => {
              mutation.mutate(undefined);
            }}
          >
            {receiving ? t.receive : t.cancelTransfer}
          </Button>
        </>
      }
    >
      {mutation.error ? <Alert tone="danger">{getErrorMessage(mutation.error)}</Alert> : null}
    </Dialog>
  );
}
