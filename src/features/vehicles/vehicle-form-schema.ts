import { z } from 'zod';
import { ar, interpolate } from '@/locales/ar';
import { FUEL_TYPES, TRANSMISSIONS, VEHICLE_TYPES, type Vehicle } from './types';

/**
 * Client-side mirror of Modules/Inventory/app/Http/Requests/VehicleRequest.php.
 * It gives instant feedback only; the backend stays authoritative and its 422 errors are
 * mapped back onto these fields (see applyServerErrors).
 */
const m = ar.vehicles.form.validation;

export const MAX_MONEY = 9_999_999_999_999.99;
export const MIN_YEAR = 1950;
export const maxYear = () => new Date().getFullYear() + 1;
const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/i;
const MONEY_PATTERN = /^\d+(\.\d{1,2})?$/;
const INT_PATTERN = /^\d+$/;
export const MAX_SPECIFICATIONS = 50;

const optionalText = (max: number) => z.string().trim().max(max, interpolate(m.maxLength, { max }));

const requiredChoice = z.string().min(1, m.required);

const optionalMoney = z
  .string()
  .trim()
  .refine((v) => v === '' || MONEY_PATTERN.test(v), m.money)
  .refine((v) => v === '' || Number(v) <= MAX_MONEY, m.moneyMax);

const specificationSchema = z.object({
  key: z.string().trim(),
  value: z
    .string()
    .trim()
    .max(255, interpolate(m.maxLength, { max: 255 })),
});

function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function createVehicleFormSchema(mode: 'create' | 'edit') {
  return z
    .object({
      stock_number: optionalText(30),
      brand_id: requiredChoice,
      model_id: requiredChoice,
      year: z
        .string()
        .trim()
        .min(1, m.required)
        .refine((v) => INT_PATTERN.test(v), m.integer)
        .refine(
          (v) => Number(v) >= MIN_YEAR && Number(v) <= maxYear(),
          interpolate(m.yearRange, { min: MIN_YEAR, max: maxYear() }),
        ),
      vin: z
        .string()
        .trim()
        .refine((v) => v === '' || VIN_PATTERN.test(v), m.vin),
      engine_number: optionalText(50),
      color: optionalText(50),
      mileage: z
        .string()
        .trim()
        .refine((v) => v === '' || INT_PATTERN.test(v), m.integer)
        .refine((v) => v === '' || Number(v) <= 2_000_000, m.mileageMax),
      transmission: z.enum(TRANSMISSIONS, { message: m.required }),
      fuel_type: z.enum(FUEL_TYPES, { message: m.required }),
      vehicle_type: z.enum(VEHICLE_TYPES, { message: m.required }),
      purchase_price: optionalMoney,
      selling_price: optionalMoney,
      purchase_date: z.string().refine((v) => v === '' || v <= todayIso(), m.notFuture),
      supplier_id: z.string(),
      branch_id: mode === 'create' ? requiredChoice : z.string(),
      description: optionalText(5000),
      specifications: z.array(specificationSchema).max(MAX_SPECIFICATIONS, m.tooManySpecs),
    })
    .superRefine((values, ctx) => {
      const seen = new Set<string>();
      values.specifications.forEach((spec, index) => {
        if (spec.key === '' && spec.value === '') return; // blank rows are ignored
        if (spec.key === '') {
          ctx.addIssue({
            code: 'custom',
            path: ['specifications', index, 'key'],
            message: m.required,
          });
        } else if (seen.has(spec.key)) {
          ctx.addIssue({
            code: 'custom',
            path: ['specifications', index, 'key'],
            message: m.duplicateSpec,
          });
        }
        seen.add(spec.key);
      });
    });
}

export type VehicleFormValues = z.input<ReturnType<typeof createVehicleFormSchema>>;

export const emptyVehicleForm: VehicleFormValues = {
  stock_number: '',
  brand_id: '',
  model_id: '',
  year: '',
  vin: '',
  engine_number: '',
  color: '',
  mileage: '',
  transmission: '' as VehicleFormValues['transmission'],
  fuel_type: '' as VehicleFormValues['fuel_type'],
  vehicle_type: '' as VehicleFormValues['vehicle_type'],
  purchase_price: '',
  selling_price: '',
  purchase_date: '',
  supplier_id: '',
  branch_id: '',
  description: '',
  specifications: [],
};

/** Prefills the edit form from the API resource. */
export function vehicleToFormValues(vehicle: Vehicle): VehicleFormValues {
  return {
    stock_number: vehicle.stock_number,
    brand_id: vehicle.brand ? String(vehicle.brand.id) : '',
    model_id: vehicle.model ? String(vehicle.model.id) : '',
    year: String(vehicle.year),
    vin: vehicle.vin ?? '',
    engine_number: vehicle.engine_number ?? '',
    color: vehicle.color ?? '',
    mileage: String(vehicle.mileage),
    transmission: vehicle.transmission,
    fuel_type: vehicle.fuel_type,
    vehicle_type: vehicle.vehicle_type,
    purchase_price: '',
    selling_price: vehicle.selling_price ?? '',
    purchase_date: vehicle.purchase_date ?? '',
    supplier_id: vehicle.supplier ? String(vehicle.supplier.id) : '',
    branch_id: vehicle.branch ? String(vehicle.branch.id) : '',
    description: vehicle.description ?? '',
    specifications: Object.entries(vehicle.specifications ?? {}).map(([key, value]) => ({
      key,
      value,
    })),
  };
}

export interface VehiclePayload {
  stock_number?: string;
  brand_id: number;
  model_id: number;
  year: number;
  vin: string | null;
  engine_number: string | null;
  color: string | null;
  mileage?: number;
  transmission: string;
  fuel_type: string;
  vehicle_type: string;
  purchase_price?: string;
  selling_price: string | null;
  purchase_date: string | null;
  supplier_id: number | null;
  branch_id?: number;
  description: string | null;
  specifications: Record<string, string> | null;
}

/**
 * Builds the request body. Create-only fields (branch_id, purchase_price) are never sent on
 * edit: the backend marks them `prohibited` after registration.
 */
export function toVehiclePayload(
  values: VehicleFormValues,
  mode: 'create' | 'edit',
): VehiclePayload {
  const text = (v: string) => (v.trim() === '' ? null : v.trim());
  const specs = values.specifications.filter((s) => s.key.trim() !== '');

  return {
    ...(values.stock_number.trim() ? { stock_number: values.stock_number.trim() } : {}),
    brand_id: Number(values.brand_id),
    model_id: Number(values.model_id),
    year: Number(values.year),
    vin: values.vin.trim() === '' ? null : values.vin.trim().toUpperCase(),
    engine_number: text(values.engine_number),
    color: text(values.color),
    ...(values.mileage.trim() !== '' ? { mileage: Number(values.mileage) } : {}),
    transmission: values.transmission,
    fuel_type: values.fuel_type,
    vehicle_type: values.vehicle_type,
    selling_price: text(values.selling_price),
    purchase_date: values.purchase_date === '' ? null : values.purchase_date,
    supplier_id: values.supplier_id === '' ? null : Number(values.supplier_id),
    description: text(values.description),
    specifications:
      specs.length > 0
        ? Object.fromEntries(specs.map((s) => [s.key.trim(), s.value.trim()]))
        : null,
    ...(mode === 'create'
      ? {
          branch_id: Number(values.branch_id),
          ...(values.purchase_price.trim() !== ''
            ? { purchase_price: values.purchase_price.trim() }
            : {}),
        }
      : {}),
  };
}
