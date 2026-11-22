import { contractFormSchema, emptyContractForm, toContractPayload } from './contract-form-schema';
import type { ContractFormValues } from './contract-form-schema';
import { parseContractListParams, toSearchParams } from './list-params';
import { addMonths, buildSchedule, splitAmount } from './schedule';

describe('installment schedule', () => {
  it('splits exactly, putting the rounding remainder on the last installment', () => {
    expect(splitAmount('1000.00', 3)).toEqual(['333.33', '333.33', '333.34']);
    expect(splitAmount('0.05', 2)).toEqual(['0.02', '0.03']);
  });

  it('adds months and clamps end-of-month dates', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonths('2026-12-01', 12)).toBe('2027-12-01');
  });

  it('builds dates by frequency; custom leaves later dates to the user', () => {
    expect(
      buildSchedule({ total: '900.00', count: 3, frequency: 'quarterly', startDate: '2026-12-01' }),
    ).toEqual([
      { amount: '300.00', due_date: '2026-12-01' },
      { amount: '300.00', due_date: '2027-03-01' },
      { amount: '300.00', due_date: '2027-06-01' },
    ]);
    const custom = buildSchedule({
      total: '100.00',
      count: 2,
      frequency: 'custom',
      startDate: '2026-12-01',
    });
    expect(custom.map((r) => r.due_date)).toEqual(['2026-12-01', '']);
  });
});

describe('contract form rules', () => {
  const base = (): ContractFormValues => ({
    ...emptyContractForm(),
    vehicle_id: '77',
    customer_id: '9',
    sales_employee_id: '2',
    contract_date: '2026-11-01',
    selling_price: '1000000',
    discount: '50000',
  });
  const paths = (values: ContractFormValues) =>
    contractFormSchema.safeParse(values).error?.issues.map((i) => i.path.join('.')) ?? [];

  it('cash: requires a receipt and rejects paying more than the contract', () => {
    const v = { ...base(), payment_type: 'cash' };
    expect(paths(v)).toEqual(
      expect.arrayContaining(['payment.amount', 'payment.payment_method', 'payment.cashbox_id']),
    );
    const ok = {
      ...v,
      payment: { ...v.payment, amount: '950000', payment_method: 'cash', cashbox_id: '1' },
    };
    expect(paths(ok)).toEqual([]);
    expect(paths({ ...ok, payment: { ...ok.payment, amount: '950000.01' } })).toEqual([
      'payment.amount',
    ]);
    expect(paths({ ...ok, discount: '1000001' })).toContain('discount');
  });

  it('installment: down payment below the final amount and schedule summing to the rest', () => {
    const first = { amount: '300000', due_date: '2026-12-01' };
    const v: ContractFormValues = {
      ...base(),
      payment_type: 'installment',
      down_payment: '350000',
      down_payment_receipt: { cashbox_id: '1', payment_method: 'cash', reference: '' },
      installment_frequency: 'monthly',
      start_date: '2026-12-01',
      number_of_installments: '2',
      installments: [first, { amount: '300000', due_date: '2027-01-01' }],
    };
    expect(paths(v)).toEqual([]);
    expect(paths({ ...v, down_payment: '950000' })).toContain('down_payment');
    expect(
      paths({ ...v, installments: [first, { amount: '299999.99', due_date: '2027-01-01' }] }),
    ).toEqual(['installments']);
    expect(
      paths({ ...v, installments: [first, { amount: '300000', due_date: '2026-10-01' }] }),
    ).toEqual(['installments.1.due_date']);

    const payload = toContractPayload(v);
    expect(payload).toMatchObject({
      payment_type: 'installment',
      down_payment: '350000',
      down_payment_receipt: { cashbox_id: 1, payment_method: 'cash', reference: null },
      number_of_installments: 2,
    });
    expect(payload).not.toHaveProperty('payment');
    expect(payload).not.toHaveProperty('bank_financing');
  });

  it('bank financing: no receipt for a zero down payment; financing within the balance', () => {
    const v: ContractFormValues = {
      ...base(),
      payment_type: 'bank_financing',
      down_payment: '0',
      bank_financing: {
        bank_id: '3',
        transaction_reference: '',
        application_date: '2026-11-01',
        expected_amount: '950000',
        internal_notes: '',
      },
    };
    expect(paths(v)).toEqual([]);
    expect(toContractPayload(v)).not.toHaveProperty('down_payment_receipt');
    expect(
      paths({ ...v, bank_financing: { ...v.bank_financing, expected_amount: '950000.01' } }),
    ).toEqual(['bank_financing.expected_amount']);
  });
});

describe('contract list params', () => {
  it('validates dates and orders the range', () => {
    const params = parseContractListParams(
      new URLSearchParams('date_from=2026-12-01&date_to=2026-01-01&payment_type=lease'),
    );
    expect(params.date_from).toBe('2026-01-01');
    expect(params.date_to).toBe('2026-12-01');
    expect(params.filter).toEqual({});
    expect(toSearchParams(params).toString()).toBe('date_from=2026-01-01&date_to=2026-12-01');
  });
});
