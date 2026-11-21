import {
  createVehicleFormSchema,
  emptyVehicleForm,
  maxYear,
  toVehiclePayload,
  vehicleToFormValues,
  type VehicleFormValues,
} from './vehicle-form-schema';
import type { Vehicle } from './types';

const valid: VehicleFormValues = {
  ...emptyVehicleForm,
  brand_id: '1',
  model_id: '11',
  year: '2024',
  transmission: 'automatic',
  fuel_type: 'petrol',
  vehicle_type: 'sedan',
  branch_id: '1',
};

function issues(values: Partial<VehicleFormValues>, mode: 'create' | 'edit' = 'create') {
  const result = createVehicleFormSchema(mode).safeParse({ ...valid, ...values });
  return result.success
    ? {}
    : Object.fromEntries(result.error.issues.map((i) => [i.path.join('.'), i.message]));
}

describe('vehicle form schema', () => {
  it('accepts a minimal valid vehicle', () => {
    expect(issues({})).toEqual({});
  });

  it('requires the fields the backend requires on create', () => {
    const result = issues({
      brand_id: '',
      model_id: '',
      year: '',
      branch_id: '',
      transmission: '' as never,
    });
    expect(Object.keys(result)).toEqual(
      expect.arrayContaining(['brand_id', 'model_id', 'year', 'branch_id', 'transmission']),
    );
  });

  it('does not require branch on edit (it is fixed after registration)', () => {
    expect(issues({ branch_id: '' }, 'edit')).toEqual({});
  });

  it('validates VIN like the backend (17 chars, no I/O/Q)', () => {
    expect(issues({ vin: 'JTDBR32E720123456' })).toEqual({});
    expect(issues({ vin: 'jtdbr32e720123456' })).toEqual({});
    expect(issues({ vin: 'JTDBR32E72012345' })).toHaveProperty('vin');
    expect(issues({ vin: 'JTDBR32E72012345O' })).toHaveProperty('vin');
  });

  it('validates year range, integers and money', () => {
    expect(issues({ year: '1949' })).toHaveProperty('year');
    expect(issues({ year: String(maxYear() + 1) })).toHaveProperty('year');
    expect(issues({ year: '2024.5' })).toHaveProperty('year');
    expect(issues({ mileage: '-5' })).toHaveProperty('mileage');
    expect(issues({ mileage: '2000001' })).toHaveProperty('mileage');
    expect(issues({ selling_price: '1250000.5' })).toEqual({});
    expect(issues({ selling_price: '12.345' })).toHaveProperty('selling_price');
    expect(issues({ selling_price: '1,000' })).toHaveProperty('selling_price');
    expect(issues({ purchase_date: '2999-01-01' })).toHaveProperty('purchase_date');
  });

  it('flags duplicate and keyless specifications, ignoring blank rows', () => {
    expect(issues({ specifications: [{ key: '', value: '' }] })).toEqual({});
    expect(issues({ specifications: [{ key: '', value: 'x' }] })).toHaveProperty(
      'specifications.0.key',
    );
    expect(
      issues({
        specifications: [
          { key: 'لون', value: 'a' },
          { key: 'لون', value: 'b' },
        ],
      }),
    ).toHaveProperty('specifications.1.key');
  });
});

describe('toVehiclePayload', () => {
  const filled: VehicleFormValues = {
    ...valid,
    vin: ' jtdbr32e720123456 ',
    color: 'أبيض',
    mileage: '12500',
    purchase_price: '1000000',
    selling_price: '1250000.50',
    supplier_id: '5',
    specifications: [
      { key: 'فتحة سقف', value: 'نعم' },
      { key: '', value: '' },
    ],
  };

  it('builds the create body with typed values', () => {
    expect(toVehiclePayload(filled, 'create')).toEqual({
      brand_id: 1,
      model_id: 11,
      year: 2024,
      vin: 'JTDBR32E720123456',
      engine_number: null,
      color: 'أبيض',
      mileage: 12500,
      transmission: 'automatic',
      fuel_type: 'petrol',
      vehicle_type: 'sedan',
      selling_price: '1250000.50',
      purchase_date: null,
      supplier_id: 5,
      description: null,
      specifications: { 'فتحة سقف': 'نعم' },
      branch_id: 1,
      purchase_price: '1000000',
    });
  });

  it('never sends fields the backend prohibits on update', () => {
    const body = toVehiclePayload(filled, 'edit');
    expect(body).not.toHaveProperty('branch_id');
    expect(body).not.toHaveProperty('purchase_price');
    expect(body).not.toHaveProperty('status');
  });

  it('omits an empty stock number so the backend generates one', () => {
    expect(toVehiclePayload(valid, 'create')).not.toHaveProperty('stock_number');
  });

  it('round-trips an API vehicle into edit values', () => {
    const vehicle = {
      id: 1,
      stock_number: 'STK1',
      brand: { id: 1, name: 'Toyota' },
      model: { id: 11, name: 'Corolla' },
      year: 2024,
      vin: null,
      engine_number: null,
      color: null,
      mileage: 0,
      transmission: 'manual',
      fuel_type: 'diesel',
      vehicle_type: 'van',
      selling_price: null,
      purchase_date: null,
      supplier: null,
      branch: { id: 2, name: 'B' },
      description: null,
      specifications: { a: 'b' },
      status: 'available',
      created_at: '',
      updated_at: '',
    } satisfies Vehicle;

    const values = vehicleToFormValues(vehicle);
    expect(values).toMatchObject({
      brand_id: '1',
      model_id: '11',
      year: '2024',
      mileage: '0',
      branch_id: '2',
    });
    expect(values.specifications).toEqual([{ key: 'a', value: 'b' }]);
    expect(createVehicleFormSchema('edit').safeParse(values).success).toBe(true);
  });
});
