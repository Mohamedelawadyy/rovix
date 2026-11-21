import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router';
import { ForbiddenPage, NotFoundPage } from '@/app/pages/StatusPages';
import { Alert } from '@/components/ui/Alert';
import { useAuth } from '@/features/auth/auth-context';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { isApiError } from '@/lib/api';
import { getErrorMessage } from '@/lib/api/error-message';
import { ar, interpolate } from '@/locales/ar';
import { vehicleKeys, vehiclesApi } from '../api/vehicles-api';
import { VehicleForm } from '../components/VehicleForm';
import type { Vehicle } from '../types';
import { emptyVehicleForm, vehicleToFormValues, type VehiclePayload } from '../vehicle-form-schema';
import { parseVehicleId } from '../vehicle-id';
import type { VehicleDetailLinkState } from './VehicleDetailPage';

const t = ar.vehicles.form;

function useOnSaved() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return (vehicle: Vehicle, notice: string) => {
    queryClient.setQueryData(vehicleKeys.detail(vehicle.id), vehicle);
    void queryClient.invalidateQueries({ queryKey: [...vehicleKeys.all, 'list'] });
    void queryClient.invalidateQueries({ queryKey: vehicleKeys.history(vehicle.id) });
    const state: VehicleDetailLinkState = { notice };
    void navigate(`/vehicles/${String(vehicle.id)}`, { state });
  };
}

function PageHeader({ title, back }: { title: string; back: string }) {
  return (
    <header className="flex flex-col gap-2">
      <Link to={back} className="text-sm text-accent hover:underline">
        → {ar.vehicles.detail.back}
      </Link>
      <h1 className="text-2xl font-semibold text-fg">{title}</h1>
    </header>
  );
}

/** /vehicles/new — guarded by `vehicles.create` in the router. */
export function VehicleCreatePage() {
  useDocumentTitle(t.createTitle);
  const { user, can } = useAuth();
  const onSaved = useOnSaved();

  // Pre-select the branch when the user works in exactly one.
  const ownBranches = user?.branches ?? [];
  const defaultBranch =
    !can('branches.view') && ownBranches.length === 1 ? String(ownBranches[0]?.id ?? '') : '';

  return (
    <section className="flex flex-col gap-5">
      <PageHeader title={t.createTitle} back="/vehicles" />
      <VehicleForm
        mode="create"
        defaultValues={{ ...emptyVehicleForm, branch_id: defaultBranch }}
        cancelTo="/vehicles"
        onSubmit={async (payload: VehiclePayload) => {
          onSaved(await vehiclesApi.create(payload), t.created);
        }}
      />
    </section>
  );
}

/** /vehicles/:vehicleId/edit — guarded by `vehicles.update` in the router. */
export function VehicleEditPage() {
  const id = parseVehicleId(useParams().vehicleId);
  if (id === null) return <NotFoundPage />;
  return <VehicleEdit id={id} />;
}

function VehicleEdit({ id }: { id: number }) {
  const onSaved = useOnSaved();
  const query = useQuery({
    queryKey: vehicleKeys.detail(id),
    queryFn: ({ signal }) => vehiclesApi.get(id, signal),
  });
  const vehicle = query.data;
  const name = vehicle
    ? [vehicle.brand?.name, vehicle.model?.name, vehicle.year].filter(Boolean).join(' ')
    : '';
  useDocumentTitle(vehicle ? interpolate(t.editTitle, { name }) : t.edit);

  const error = query.error;
  if (isApiError(error) && error.kind === 'not_found') return <NotFoundPage />;
  if (isApiError(error) && error.kind === 'forbidden') return <ForbiddenPage />;

  const detailPath = `/vehicles/${String(id)}`;

  if (!vehicle) {
    return (
      <section className="flex flex-col gap-5">
        <PageHeader title={t.edit} back={detailPath} />
        {query.isError ? (
          <Alert tone="danger">
            {ar.list.loadError} {getErrorMessage(error)}
          </Alert>
        ) : (
          <p role="status" className="py-12 text-center text-fg-muted">
            {ar.common.loading}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5">
      <PageHeader title={interpolate(t.editTitle, { name })} back={detailPath} />
      <VehicleForm
        // Remount with fresh defaults if the vehicle changes underneath (e.g. refetch after save).
        key={vehicle.updated_at}
        mode="edit"
        defaultValues={vehicleToFormValues(vehicle)}
        cancelTo={detailPath}
        current={{
          ...(vehicle.brand ? { brand: vehicle.brand } : {}),
          ...(vehicle.model ? { model: vehicle.model } : {}),
          supplier: vehicle.supplier ?? null,
          ...(vehicle.branch ? { branch: vehicle.branch } : {}),
        }}
        onSubmit={async (payload: VehiclePayload) => {
          onSaved(await vehiclesApi.update(id, payload), t.updated);
        }}
      />
    </section>
  );
}
