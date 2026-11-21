import {
  createCustomerFormSchema,
  customerToFormValues,
  emptyCustomerForm,
  toCustomerPayload,
  type CustomerFormValues,
} from './customer-form-schema';
import { parseCustomerListParams, toSearchParams } from './list-params';
import type { Customer } from './types';

const valid: CustomerFormValues = {
  ...emptyCustomerForm,
  name: ' أحمد علي ',
  phone: '+201001234567',
  branch_id: '1',
};

const customer: Customer = {
  id: 9,
  customer_code: 'CUS000009',
  name: 'أحمد علي',
  phone: '01001234567',
  email: null,
  national_id: '**********1234',
  address: null,
  notes: null,
  status: 'active',
  branch: { id: 1, name: 'مدينة نصر' },
  created_at: '2026-11-01T10:00:00+02:00',
};

describe('customer form schema', () => {
  const schema = createCustomerFormSchema('create');

  it('mirrors the backend rules', () => {
    expect(schema.safeParse(valid).success).toBe(true);
    const issues = (values: Partial<CustomerFormValues>) =>
      schema.safeParse({ ...valid, ...values }).error?.issues.map((i) => i.path[0]) ?? [];

    expect(issues({ name: '  ' })).toEqual(['name']);
    expect(issues({ phone: '0100-123' })).toEqual(['phone']);
    expect(issues({ phone: '123456' })).toEqual(['phone']);
    expect(issues({ national_id: '2990101123456' })).toEqual(['national_id']);
    expect(issues({ national_id: '29901011234567' })).toEqual([]);
    expect(issues({ email: 'not-an-email' })).toEqual(['email']);
    expect(issues({ branch_id: '' })).toEqual(['branch_id']);
    // The branch cannot be changed after creation, so edit does not require it.
    expect(createCustomerFormSchema('edit').safeParse({ ...valid, branch_id: '' }).success).toBe(
      true,
    );
  });
});

describe('toCustomerPayload', () => {
  it('sends branch only on create and omits an empty code / national ID', () => {
    expect(toCustomerPayload(valid, 'create')).toEqual({
      name: 'أحمد علي',
      phone: '+201001234567',
      email: null,
      address: null,
      notes: null,
      status: 'active',
      branch_id: 1,
    });
    expect(toCustomerPayload(valid, 'edit')).not.toHaveProperty('branch_id');
  });

  it('never sends a masked national ID back, and keeps it when the field is left empty', () => {
    const values = customerToFormValues(customer);
    expect(values.national_id).toBe('');
    expect(toCustomerPayload(values, 'edit', values.national_id)).not.toHaveProperty('national_id');
    expect(
      toCustomerPayload({ ...values, national_id: '29901011234567' }, 'edit', ''),
    ).toMatchObject({ national_id: '29901011234567' });
  });

  it('with the real number prefilled, sends it only when changed (empty clears it)', () => {
    const values = customerToFormValues({ ...customer, national_id: '29901011234567' });
    expect(values.national_id).toBe('29901011234567');
    expect(toCustomerPayload(values, 'edit', '29901011234567')).not.toHaveProperty('national_id');
    expect(
      toCustomerPayload({ ...values, national_id: '' }, 'edit', '29901011234567'),
    ).toMatchObject({ national_id: null });
  });
});

describe('customer list params', () => {
  it('keeps only allowlisted values', () => {
    const params = parseCustomerListParams(
      new URLSearchParams('status=deleted&branch_id=x&sort=phone&per_page=7&search=  علي '),
    );
    expect(params).toEqual({
      page: 1,
      per_page: 15,
      sort: '-created_at',
      search: 'علي',
      filter: {},
    });
  });

  it('round-trips through the URL', () => {
    const search = 'search=010&status=inactive&branch_id=2&sort=name&per_page=30&page=3';
    expect(toSearchParams(parseCustomerListParams(new URLSearchParams(search))).toString()).toBe(
      search,
    );
  });
});
