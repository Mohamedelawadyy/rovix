import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import { Card } from '@/components/shared/DetailList';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Select, type SelectOption } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/features/auth/auth-context';
import { isApiError } from '@/lib/api';
import { getErrorMessage } from '@/lib/api/error-message';
import { applyServerErrors } from '@/lib/forms/server-errors';
import { ar, interpolate } from '@/locales/ar';
import { vehicleKeys, vehiclesApi } from '../api/vehicles-api';
import { fuelTypeLabels, transmissionLabels, vehicleTypeLabels } from '../labels';
import { FUEL_TYPES, TRANSMISSIONS, VEHICLE_TYPES, type IdName } from '../types';
import {
  createVehicleFormSchema,
  MAX_SPECIFICATIONS,
  maxYear,
  MIN_YEAR,
  toVehiclePayload,
  type VehicleFormValues,
  type VehiclePayload,
} from '../vehicle-form-schema';

const t = ar.vehicles.form;
const f = t.fields;
const LOOKUP_STALE_TIME = 10 * 60 * 1000;

/** Fields rendered by the form, for mapping server 422 errors (others go to the form alert). */
const FORM_FIELDS = [
  'stock_number',
  'brand_id',
  'model_id',
  'year',
  'vin',
  'engine_number',
  'color',
  'mileage',
  'transmission',
  'fuel_type',
  'vehicle_type',
  'purchase_price',
  'selling_price',
  'purchase_date',
  'supplier_id',
  'branch_id',
  'description',
  'specifications',
] as const;

function enumOptions<T extends string>(values: readonly T[], labels: Record<T, string>) {
  return values.map((value) => ({ value, label: labels[value] }));
}

/** Keeps the current value selectable even if it is no longer in the (active-only) lookup. */
function withCurrent(options: SelectOption[], current: IdName | null | undefined): SelectOption[] {
  if (!current || options.some((o) => o.value === String(current.id))) return options;
  return [{ value: String(current.id), label: current.name }, ...options];
}

export interface VehicleFormProps {
  mode: 'create' | 'edit';
  defaultValues: VehicleFormValues;
  /** Persists the vehicle; rejects with ApiError on failure. */
  onSubmit: (payload: VehiclePayload) => Promise<unknown>;
  cancelTo: string;
  /** Edit mode: current catalog/supplier/branch, shown even if inactive. */
  current?: { brand?: IdName; model?: IdName; supplier?: IdName | null; branch?: IdName };
}

export function VehicleForm({
  mode,
  defaultValues,
  onSubmit,
  cancelTo,
  current,
}: VehicleFormProps) {
  const { user, can } = useAuth();
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(createVehicleFormSchema(mode)),
    defaultValues,
    mode: 'onTouched',
  });
  const specs = useFieldArray({ control, name: 'specifications' });

  const brandId = useWatch({ control, name: 'brand_id' });
  const canListBranches = can('branches.view');
  const canListSuppliers = can('suppliers.view');

  const brands = useQuery({
    queryKey: vehicleKeys.brands,
    queryFn: ({ signal }) => vehiclesApi.brands(signal),
    staleTime: LOOKUP_STALE_TIME,
  });
  const models = useQuery({
    queryKey: vehicleKeys.models(Number(brandId)),
    queryFn: ({ signal }) => vehiclesApi.models(Number(brandId), signal),
    enabled: brandId !== '',
    staleTime: LOOKUP_STALE_TIME,
  });
  const branches = useQuery({
    queryKey: vehicleKeys.branches,
    queryFn: ({ signal }) => vehiclesApi.branches(signal),
    enabled: mode === 'create' && canListBranches,
    staleTime: LOOKUP_STALE_TIME,
  });
  const suppliers = useQuery({
    queryKey: vehicleKeys.suppliers,
    queryFn: ({ signal }) => vehiclesApi.suppliers(signal),
    enabled: canListSuppliers,
    staleTime: LOOKUP_STALE_TIME,
  });

  const brandOptions = withCurrent(
    (brands.data?.items ?? []).map((b) => ({ value: String(b.id), label: b.name })),
    current?.brand,
  );
  const modelOptions = withCurrent(
    (models.data?.items ?? []).map((model) => ({ value: String(model.id), label: model.name })),
    brandId === String(current?.brand?.id) ? current?.model : undefined,
  );
  const branchOptions = (
    canListBranches ? (branches.data?.items ?? []) : (user?.branches ?? [])
  ).map((branch) => ({ value: String(branch.id), label: branch.name }));
  const supplierOptions = withCurrent(
    (suppliers.data?.items ?? []).map((s) => ({ value: String(s.id), label: s.name })),
    current?.supplier,
  );

  const submit = handleSubmit(async (values) => {
    setFormErrors([]);
    try {
      await onSubmit(toVehiclePayload(values, mode));
    } catch (error) {
      if (isApiError(error) && error.kind === 'validation') {
        const unmatched = applyServerErrors(error, setError, FORM_FIELDS);
        setFormErrors(unmatched.length > 0 ? unmatched : [t.serverErrors]);
      } else {
        setFormErrors([getErrorMessage(error)]);
      }
    }
  });

  const err = (name: keyof VehicleFormValues) => errors[name]?.message;

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
      {formErrors.length > 0 ? (
        <Alert tone="danger">
          <ul className="list-inside list-disc">
            {formErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <Card title={t.sections.identity}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Select
            labelSize="md"
            label={f.brand}
            placeholder={t.choose}
            options={brandOptions}
            error={err('brand_id')}
            {...register('brand_id', {
              onChange: () => {
                // A model belongs to one brand: reset it when the brand changes.
                setValue('model_id', '');
              },
            })}
          />
          <Select
            labelSize="md"
            label={f.model}
            placeholder={brandId === '' ? f.chooseBrandFirst : t.choose}
            disabled={brandId === ''}
            options={modelOptions}
            error={err('model_id')}
            {...register('model_id')}
          />
          <TextField
            label={f.year}
            inputMode="numeric"
            dir="ltr"
            placeholder={`${String(MIN_YEAR)}–${String(maxYear())}`}
            error={err('year')}
            {...register('year')}
          />
          <TextField
            label={f.vin}
            optional
            dir="ltr"
            maxLength={17}
            autoCapitalize="characters"
            hint={f.vinHint}
            error={err('vin')}
            {...register('vin')}
          />
          <TextField
            label={f.engineNumber}
            optional
            dir="ltr"
            error={err('engine_number')}
            {...register('engine_number')}
          />
          <TextField
            label={f.stockNumber}
            optional
            dir="ltr"
            hint={mode === 'create' ? f.stockNumberHint : undefined}
            error={err('stock_number')}
            {...register('stock_number')}
          />
          {mode === 'create' ? (
            <Select
              labelSize="md"
              label={f.branch}
              placeholder={t.choose}
              options={branchOptions}
              hint={f.branchHint}
              error={err('branch_id')}
              {...register('branch_id')}
            />
          ) : null}
        </div>
      </Card>

      <Card title={t.sections.specs}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Select
            labelSize="md"
            label={f.vehicleType}
            placeholder={t.choose}
            options={enumOptions(VEHICLE_TYPES, vehicleTypeLabels)}
            error={err('vehicle_type')}
            {...register('vehicle_type')}
          />
          <Select
            labelSize="md"
            label={f.fuelType}
            placeholder={t.choose}
            options={enumOptions(FUEL_TYPES, fuelTypeLabels)}
            error={err('fuel_type')}
            {...register('fuel_type')}
          />
          <Select
            labelSize="md"
            label={f.transmission}
            placeholder={t.choose}
            options={enumOptions(TRANSMISSIONS, transmissionLabels)}
            error={err('transmission')}
            {...register('transmission')}
          />
          <TextField label={f.color} optional error={err('color')} {...register('color')} />
          <TextField
            label={f.mileage}
            optional
            inputMode="numeric"
            dir="ltr"
            error={err('mileage')}
            {...register('mileage')}
          />
        </div>
      </Card>

      <Card title={t.sections.pricing}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {mode === 'create' && can('vehicles.view-cost') ? (
            <TextField
              label={f.purchasePrice}
              optional
              inputMode="decimal"
              dir="ltr"
              hint={f.purchasePriceHint}
              error={err('purchase_price')}
              {...register('purchase_price')}
            />
          ) : null}
          <TextField
            label={f.sellingPrice}
            optional
            inputMode="decimal"
            dir="ltr"
            error={err('selling_price')}
            {...register('selling_price')}
          />
          <TextField
            label={f.purchaseDate}
            optional
            type="date"
            error={err('purchase_date')}
            {...register('purchase_date')}
          />
          {canListSuppliers ? (
            <Select
              labelSize="md"
              label={f.supplier}
              optional
              placeholder={t.choose}
              options={supplierOptions}
              error={err('supplier_id')}
              {...register('supplier_id')}
            />
          ) : null}
        </div>
      </Card>

      <Card title={t.sections.extra}>
        <div className="flex flex-col gap-4">
          <TextArea
            label={f.description}
            optional
            maxLength={5000}
            error={err('description')}
            {...register('description')}
          />
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-medium text-fg">
              {ar.vehicles.detail.sections.specifications}
            </legend>
            {specs.fields.map((field, index) => (
              <div
                key={field.id}
                className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-2"
              >
                <TextField
                  label={f.specKey}
                  error={errors.specifications?.[index]?.key?.message}
                  {...register(`specifications.${index}.key`)}
                />
                <TextField
                  label={f.specValue}
                  error={errors.specifications?.[index]?.value?.message}
                  {...register(`specifications.${index}.value`)}
                />
                <Button
                  variant="ghost"
                  aria-label={interpolate(f.removeSpec, { index: index + 1 })}
                  onClick={() => {
                    specs.remove(index);
                  }}
                >
                  ✕
                </Button>
              </div>
            ))}
            {errors.specifications?.message ? (
              <p className="text-xs text-danger">{errors.specifications.message}</p>
            ) : null}
            {errors.specifications?.root?.message ? (
              <p className="text-xs text-danger">{errors.specifications.root.message}</p>
            ) : null}
            <div>
              <Button
                variant="secondary"
                disabled={specs.fields.length >= MAX_SPECIFICATIONS}
                onClick={() => {
                  specs.append({ key: '', value: '' });
                }}
              >
                + {f.addSpec}
              </Button>
            </div>
          </fieldset>
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" variant="primary" loading={isSubmitting} loadingLabel={t.saving}>
          {mode === 'create' ? t.save : t.saveChanges}
        </Button>
        <Link
          to={cancelTo}
          className="inline-flex h-10 items-center rounded-md px-4 text-sm text-fg-secondary hover:bg-surface-muted"
        >
          {t.cancel}
        </Link>
      </div>
    </form>
  );
}
