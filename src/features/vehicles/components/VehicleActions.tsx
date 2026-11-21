import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Select } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { useAuth } from '@/features/auth/auth-context';
import { isApiError } from '@/lib/api';
import { getErrorMessage } from '@/lib/api/error-message';
import { ar, interpolate } from '@/locales/ar';
import { vehicleKeys, vehiclesApi } from '../api/vehicles-api';
import { vehicleStatusLabels } from '../labels';
import type { Vehicle } from '../types';
import { useVehicleMutation } from '../use-vehicle-mutation';

const t = ar.vehicles.actions;

type Action = 'status' | 'transfer' | 'delete' | null;

function fieldError(error: unknown, field: string): string | undefined {
  return isApiError(error) && error.kind === 'validation' ? error.fieldError(field) : undefined;
}

function formError(error: unknown, fields: string[]): string | null {
  if (!error) return null;
  if (isApiError(error) && error.kind === 'validation') {
    const known = fields.some((field) => error.fieldError(field));
    return known ? null : error.message;
  }
  // 409 business rules come back with a localized message (e.g. vehicle not available).
  return getErrorMessage(error);
}

/**
 * Manual actions the backend allows from the vehicle page:
 * maintenance in/out (available ⇄ under_maintenance), branch transfer (available only),
 * and delete (available / under_maintenance only). Each is shown only with its permission.
 */
export function VehicleActions({
  vehicle,
  name,
  onDone,
}: {
  vehicle: Vehicle;
  name: string;
  onDone: (message: string) => void;
}) {
  const { can } = useAuth();
  const [action, setAction] = useState<Action>(null);

  const isAvailable = vehicle.status === 'available';
  const inMaintenance = vehicle.status === 'under_maintenance';
  const canStatus = can('vehicles.update') && (isAvailable || inMaintenance);
  const canTransfer = can('vehicles.transfer') && isAvailable;
  const canDelete = can('vehicles.delete') && (isAvailable || inMaintenance);

  if (!canStatus && !canTransfer && !canDelete) return null;

  const close = () => {
    setAction(null);
  };

  return (
    <div role="group" aria-label={t.label} className="flex flex-wrap gap-2">
      {canStatus ? (
        <Button
          variant="secondary"
          onClick={() => {
            setAction('status');
          }}
        >
          {isAvailable ? t.toMaintenance : t.fromMaintenance}
        </Button>
      ) : null}
      {canTransfer ? (
        <Button
          variant="secondary"
          onClick={() => {
            setAction('transfer');
          }}
        >
          {t.transfer}
        </Button>
      ) : null}
      {canDelete ? (
        <Button
          variant="danger"
          onClick={() => {
            setAction('delete');
          }}
        >
          {t.delete}
        </Button>
      ) : null}

      {action === 'status' ? (
        <StatusDialog
          vehicle={vehicle}
          onClose={close}
          onDone={(message) => {
            close();
            onDone(message);
          }}
        />
      ) : null}
      {action === 'transfer' ? (
        <TransferDialog
          vehicle={vehicle}
          onClose={close}
          onDone={(message) => {
            close();
            onDone(message);
          }}
        />
      ) : null}
      {action === 'delete' ? <DeleteDialog vehicle={vehicle} name={name} onClose={close} /> : null}
    </div>
  );
}

function StatusDialog({
  vehicle,
  onClose,
  onDone,
}: {
  vehicle: Vehicle;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const target = vehicle.status === 'available' ? 'under_maintenance' : 'available';
  const [reason, setReason] = useState('');
  const mutation = useVehicleMutation(
    () => vehiclesApi.changeStatus(vehicle.id, { status: target, reason: reason.trim() }),
    () => {
      onDone(t.statusChanged);
    },
  );
  const error = formError(mutation.error, ['reason', 'status']);

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!mutation.isPending}
      title={t.statusTitle}
      description={interpolate(t.statusTo, { status: vehicleStatusLabels[target] })}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            {t.close}
          </Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            loadingLabel={t.working}
            onClick={() => {
              mutation.mutate(undefined);
            }}
          >
            {t.confirmStatus}
          </Button>
        </>
      }
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <TextArea
        label={t.reason}
        hint={t.reasonHint}
        maxLength={255}
        rows={3}
        value={reason}
        error={fieldError(mutation.error, 'reason')}
        onChange={(event) => {
          setReason(event.target.value);
        }}
      />
    </Dialog>
  );
}

function TransferDialog({
  vehicle,
  onClose,
  onDone,
}: {
  vehicle: Vehicle;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { user, can } = useAuth();
  const canListBranches = can('branches.view');
  const branches = useQuery({
    queryKey: vehicleKeys.branches,
    queryFn: ({ signal }) => vehiclesApi.branches(signal),
    enabled: canListBranches,
    staleTime: 10 * 60 * 1000,
  });
  // The API accepts any active branch, but the UI can only offer branches it can list:
  // /branches (scoped to the user) or the user's own branches.
  const options = (canListBranches ? (branches.data?.items ?? []) : (user?.branches ?? []))
    .filter((branch) => branch.id !== vehicle.branch?.id)
    .map((branch) => ({ value: String(branch.id), label: branch.name }));

  const [toBranch, setToBranch] = useState('');
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);
  const mutation = useVehicleMutation(
    () =>
      vehiclesApi.transfer(vehicle.id, {
        to_branch_id: Number(toBranch),
        notes: notes.trim() === '' ? null : notes.trim(),
      }),
    () => {
      onDone(t.transferStarted);
    },
  );
  const error = formError(mutation.error, ['to_branch_id', 'notes']);
  const loadingOptions = canListBranches && branches.isPending;

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!mutation.isPending}
      title={t.transferTitle}
      description={t.transferHint}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            {t.close}
          </Button>
          <Button
            variant="primary"
            disabled={options.length === 0}
            loading={mutation.isPending}
            loadingLabel={t.working}
            onClick={() => {
              setTouched(true);
              if (toBranch !== '') mutation.mutate(undefined);
            }}
          >
            {t.confirmTransfer}
          </Button>
        </>
      }
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {!loadingOptions && options.length === 0 ? (
        <Alert tone="warning">{t.noOtherBranches}</Alert>
      ) : (
        <Select
          labelSize="md"
          label={t.toBranch}
          placeholder={ar.vehicles.form.choose}
          options={options}
          value={toBranch}
          error={
            (touched && toBranch === '' ? ar.vehicles.form.validation.required : undefined) ??
            fieldError(mutation.error, 'to_branch_id')
          }
          onChange={(event) => {
            setToBranch(event.target.value);
          }}
        />
      )}
      <TextArea
        label={t.notes}
        optional
        rows={3}
        maxLength={1000}
        value={notes}
        error={fieldError(mutation.error, 'notes')}
        onChange={(event) => {
          setNotes(event.target.value);
        }}
      />
    </Dialog>
  );
}

function DeleteDialog({
  vehicle,
  name,
  onClose,
}: {
  vehicle: Vehicle;
  name: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const mutation = useVehicleMutation(
    () => vehiclesApi.remove(vehicle.id),
    () => {
      void navigate('/vehicles', { replace: true });
    },
  );

  return (
    <Dialog
      open
      onClose={onClose}
      dismissible={!mutation.isPending}
      title={t.deleteTitle}
      description={interpolate(t.deleteBody, { name })}
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
              mutation.mutate(undefined);
            }}
          >
            {t.confirmDelete}
          </Button>
        </>
      }
    >
      {mutation.error ? <Alert tone="danger">{getErrorMessage(mutation.error)}</Alert> : null}
    </Dialog>
  );
}
