import { useQuery } from '@tanstack/react-query';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/features/auth/auth-context';
import { ar } from '@/locales/ar';
import { vehicleKeys, vehiclesApi } from '../api/vehicles-api';
import {
  fuelTypeLabels,
  transmissionLabels,
  vehicleStatusLabels,
  vehicleTypeLabels,
} from '../labels';
import type { VehicleFilters as Filters } from '../list-params';
import { FUEL_TYPES, TRANSMISSIONS, VEHICLE_STATUSES, VEHICLE_TYPES } from '../types';

const t = ar.vehicles.filters;

function enumOptions<T extends string>(values: readonly T[], labels: Record<T, string>) {
  return values.map((value) => ({ value, label: labels[value] }));
}

const YEAR_OPTIONS = (() => {
  const newest = new Date().getFullYear() + 1; // backend allows next model year
  return Array.from({ length: newest - 1990 + 1 }, (_, i) => String(newest - i)).map((year) => ({
    value: year,
    label: year,
  }));
})();

const LOOKUP_STALE_TIME = 10 * 60 * 1000;

export function VehicleFilters({
  filter,
  onChange,
}: {
  filter: Filters;
  onChange: (patch: Partial<Filters>) => void;
}) {
  const { user, can } = useAuth();
  const canListBranches = can('branches.view');

  const brands = useQuery({
    queryKey: vehicleKeys.brands,
    queryFn: ({ signal }) => vehiclesApi.brands(signal),
    staleTime: LOOKUP_STALE_TIME,
  });
  const brandId = filter.brand_id;
  const models = useQuery({
    queryKey: vehicleKeys.models(brandId ?? 0),
    queryFn: ({ signal }) => vehiclesApi.models(brandId ?? 0, signal),
    enabled: brandId !== undefined,
    staleTime: LOOKUP_STALE_TIME,
  });
  const branches = useQuery({
    queryKey: vehicleKeys.branches,
    queryFn: ({ signal }) => vehiclesApi.branches(signal),
    enabled: canListBranches,
    staleTime: LOOKUP_STALE_TIME,
  });

  // Users without branches.view still know their own branches from /auth/me.
  const branchOptions = (
    canListBranches ? (branches.data?.items ?? []) : (user?.branches ?? [])
  ).map((branch) => ({ value: String(branch.id), label: branch.name }));

  const idValue = (value: number | undefined) => (value === undefined ? '' : String(value));
  const toId = (value: string) => (value === '' ? undefined : Number(value));
  const toText = (value: string) => (value === '' ? undefined : value);

  return (
    <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <legend className="sr-only">{t.label}</legend>
      <Select
        label={t.status}
        placeholder={ar.common.all}
        options={enumOptions(VEHICLE_STATUSES, vehicleStatusLabels)}
        value={filter.status ?? ''}
        onChange={(event) => {
          onChange({ status: toText(event.target.value) });
        }}
      />
      <Select
        label={t.brand}
        placeholder={ar.common.all}
        options={(brands.data?.items ?? []).map((b) => ({ value: String(b.id), label: b.name }))}
        value={idValue(brandId)}
        onChange={(event) => {
          // Changing the brand invalidates the selected model.
          onChange({ brand_id: toId(event.target.value), model_id: undefined });
        }}
      />
      <Select
        label={t.model}
        placeholder={ar.common.all}
        disabled={brandId === undefined}
        options={(models.data?.items ?? []).map((m) => ({ value: String(m.id), label: m.name }))}
        value={idValue(filter.model_id)}
        onChange={(event) => {
          onChange({ model_id: toId(event.target.value) });
        }}
      />
      <Select
        label={t.year}
        placeholder={ar.common.all}
        options={YEAR_OPTIONS}
        value={idValue(filter.year)}
        onChange={(event) => {
          onChange({ year: toId(event.target.value) });
        }}
      />
      {branchOptions.length > 1 ? (
        <Select
          label={t.branch}
          placeholder={ar.common.all}
          options={branchOptions}
          value={idValue(filter.branch_id)}
          onChange={(event) => {
            onChange({ branch_id: toId(event.target.value) });
          }}
        />
      ) : null}
      <Select
        label={t.vehicleType}
        placeholder={ar.common.all}
        options={enumOptions(VEHICLE_TYPES, vehicleTypeLabels)}
        value={filter.vehicle_type ?? ''}
        onChange={(event) => {
          onChange({ vehicle_type: toText(event.target.value) });
        }}
      />
      <Select
        label={t.fuelType}
        placeholder={ar.common.all}
        options={enumOptions(FUEL_TYPES, fuelTypeLabels)}
        value={filter.fuel_type ?? ''}
        onChange={(event) => {
          onChange({ fuel_type: toText(event.target.value) });
        }}
      />
      <Select
        label={t.transmission}
        placeholder={ar.common.all}
        options={enumOptions(TRANSMISSIONS, transmissionLabels)}
        value={filter.transmission ?? ''}
        onChange={(event) => {
          onChange({ transmission: toText(event.target.value) });
        }}
      />
    </fieldset>
  );
}
