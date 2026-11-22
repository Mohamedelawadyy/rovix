import { z } from 'zod';
import { addMoney, compareMoney, subtractMoney } from '@/lib/money/money';
import { ar, interpolate } from '@/locales/ar';

/**
 * Client-side mirror of StoreSalesContractRequest + the business checks in
 * CreateSalesContractAction and the payment-plan handlers. Form values are nested like the
 * request body, so Laravel 422 paths (`payment.amount`, `installments.2.due_date`,
 * `bank_financing.bank_id`) land on the right field as-is. The backend stays authoritative.
 */
const m = ar.salesContracts.form.validation;

export const MAX_MONEY = '9999999999999.99';
const MONEY = /^\d+(\.\d{1,2})?$/;
export const MAX_INSTALLMENTS = 240;

export function todayIso(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

const isMoney = (v: string) => MONEY.test(v.trim()) && compareMoney(v.trim(), MAX_MONEY) <= 0;
const positive = (v: string) => isMoney(v) && compareMoney(v.trim(), 0) > 0;

const receiptSchema = z.object({
  cashbox_id: z.string(),
  payment_method: z.string(),
  reference: z
    .string()
    .trim()
    .max(100, interpolate(m.maxLength, { max: 100 })),
});

export const contractFormSchema = z
  .object({
    vehicle_id: z.string().min(1, m.required),
    customer_id: z.string().min(1, m.required),
    sales_employee_id: z.string().min(1, m.required),
    contract_date: z.string().min(1, m.required),
    payment_type: z.string().min(1, m.required),
    selling_price: z.string().trim().min(1, m.required),
    discount: z.string().trim(),
    notes: z
      .string()
      .trim()
      .max(2000, interpolate(m.maxLength, { max: 2000 })),
    // Cash sale
    payment: receiptSchema.extend({ amount: z.string().trim(), payment_date: z.string() }),
    // Installment / bank financing
    down_payment: z.string().trim(),
    down_payment_receipt: receiptSchema,
    // Installment
    installment_frequency: z.string(),
    start_date: z.string(),
    number_of_installments: z.string().trim(),
    installments: z.array(z.object({ amount: z.string().trim(), due_date: z.string() })),
    // Bank financing
    bank_financing: z.object({
      bank_id: z.string(),
      transaction_reference: z
        .string()
        .trim()
        .max(100, interpolate(m.maxLength, { max: 100 })),
      application_date: z.string(),
      expected_amount: z.string().trim(),
      internal_notes: z
        .string()
        .trim()
        .max(2000, interpolate(m.maxLength, { max: 2000 })),
    }),
  })
  .superRefine((v, ctx) => {
    const issue = (path: (string | number)[], message: string) => {
      ctx.addIssue({ code: 'custom', path, message });
    };
    const today = todayIso();
    const type: string = v.payment_type;

    if (v.contract_date && v.contract_date > today) issue(['contract_date'], m.notFuture);

    if (v.selling_price && !positive(v.selling_price)) issue(['selling_price'], m.positiveMoney);
    if (v.discount && !isMoney(v.discount)) issue(['discount'], m.money);
    const priceOk = positive(v.selling_price) && (v.discount === '' || isMoney(v.discount));
    if (priceOk && v.discount && compareMoney(v.discount, v.selling_price) > 0) {
      issue(['discount'], m.discountTooHigh);
    }
    const final = priceOk ? finalAmount(v.selling_price, v.discount) : null;

    if (type === 'cash') {
      const p = v.payment;
      if (!p.amount) issue(['payment', 'amount'], m.required);
      else if (!positive(p.amount)) issue(['payment', 'amount'], m.positiveMoney);
      else if (final && compareMoney(p.amount, final) > 0) {
        issue(['payment', 'amount'], m.paymentTooHigh);
      }
      if (!p.payment_date) issue(['payment', 'payment_date'], m.required);
      else if (p.payment_date > today) issue(['payment', 'payment_date'], m.notFuture);
      if (!p.payment_method) issue(['payment', 'payment_method'], m.required);
      if (!p.cashbox_id) issue(['payment', 'cashbox_id'], m.required);
      return;
    }
    if (type !== 'installment' && type !== 'bank_financing') return;

    // Down payment (installment / bank financing)
    if (v.down_payment === '') issue(['down_payment'], m.required);
    else if (!isMoney(v.down_payment)) issue(['down_payment'], m.money);
    const downOk = v.down_payment !== '' && isMoney(v.down_payment);
    if (downOk && final && compareMoney(v.down_payment, final) >= 0) {
      issue(['down_payment'], m.downPaymentTooHigh);
    }
    if (downOk && compareMoney(v.down_payment, 0) > 0) {
      if (!v.down_payment_receipt.cashbox_id)
        issue(['down_payment_receipt', 'cashbox_id'], m.required);
      if (!v.down_payment_receipt.payment_method) {
        issue(['down_payment_receipt', 'payment_method'], m.required);
      }
    }
    const remaining = final && downOk ? subtractMoney(final, v.down_payment) : null;

    if (type === 'installment') {
      if (!v.installment_frequency) issue(['installment_frequency'], m.required);
      if (!v.start_date) issue(['start_date'], m.required);
      else if (v.contract_date && v.start_date < v.contract_date) {
        issue(['start_date'], m.beforeContractDate);
      }
      const count = Number(v.number_of_installments);
      if (!/^\d+$/.test(v.number_of_installments) || count < 1 || count > MAX_INSTALLMENTS) {
        issue(
          ['number_of_installments'],
          interpolate(m.installmentCount, { max: MAX_INSTALLMENTS }),
        );
      } else if (v.installments.length !== count) {
        issue(['installments'], m.scheduleNotBuilt);
      }
      v.installments.forEach((row, i) => {
        if (!positive(row.amount)) issue(['installments', i, 'amount'], m.positiveMoney);
        if (!row.due_date) issue(['installments', i, 'due_date'], m.required);
        else if (v.contract_date && row.due_date < v.contract_date) {
          issue(['installments', i, 'due_date'], m.beforeContractDate);
        }
      });
      const rowsOk = v.installments.length > 0 && v.installments.every((r) => positive(r.amount));
      if (remaining && rowsOk) {
        const total = addMoney(...v.installments.map((r) => r.amount));
        if (compareMoney(total, remaining) !== 0) {
          issue(['installments'], interpolate(m.scheduleTotal, { total, remaining }));
        }
      }
    }

    if (type === 'bank_financing') {
      const b = v.bank_financing;
      if (!b.bank_id) issue(['bank_financing', 'bank_id'], m.required);
      if (!b.application_date) issue(['bank_financing', 'application_date'], m.required);
      else if (b.application_date > today)
        issue(['bank_financing', 'application_date'], m.notFuture);
      if (!b.expected_amount) issue(['bank_financing', 'expected_amount'], m.required);
      else if (!positive(b.expected_amount)) {
        issue(['bank_financing', 'expected_amount'], m.positiveMoney);
      } else if (remaining && compareMoney(b.expected_amount, remaining) > 0) {
        issue(['bank_financing', 'expected_amount'], m.financingTooHigh);
      }
    }
  });

export type ContractFormValues = z.input<typeof contractFormSchema>;

export function finalAmount(sellingPrice: string, discount: string): string {
  return subtractMoney(sellingPrice.trim(), discount.trim() === '' ? '0' : discount.trim());
}

export function emptyContractForm(): ContractFormValues {
  const today = todayIso();
  return {
    vehicle_id: '',
    customer_id: '',
    sales_employee_id: '',
    contract_date: today,
    payment_type: '',
    selling_price: '',
    discount: '',
    notes: '',
    payment: { amount: '', payment_date: today, payment_method: '', cashbox_id: '', reference: '' },
    down_payment: '',
    down_payment_receipt: { cashbox_id: '', payment_method: '', reference: '' },
    installment_frequency: '',
    start_date: '',
    number_of_installments: '',
    installments: [],
    bank_financing: {
      bank_id: '',
      transaction_reference: '',
      application_date: today,
      expected_amount: '',
      internal_notes: '',
    },
  };
}

export interface ContractPayload {
  customer_id: number;
  vehicle_id: number;
  sales_employee_id: number;
  contract_date: string;
  payment_type: string;
  selling_price: string;
  discount?: string;
  notes: string | null;
  payment?: {
    amount: string;
    payment_date: string;
    payment_method: string;
    cashbox_id: number;
    reference: string | null;
  };
  down_payment?: string;
  down_payment_receipt?: { cashbox_id: number; payment_method: string; reference: string | null };
  installment_frequency?: string;
  start_date?: string;
  number_of_installments?: number;
  installments?: { amount: string; due_date: string }[];
  bank_financing?: {
    bank_id: number;
    transaction_reference: string | null;
    application_date: string;
    expected_amount: string;
    internal_notes: string | null;
  };
}

/**
 * Builds the request body. Sections that don't belong to the chosen payment type are left out
 * (the backend marks them `prohibited`); the down-payment receipt is sent only for a positive
 * down payment.
 */
export function toContractPayload(v: ContractFormValues): ContractPayload {
  const text = (s: string) => (s.trim() === '' ? null : s.trim());
  const base: ContractPayload = {
    customer_id: Number(v.customer_id),
    vehicle_id: Number(v.vehicle_id),
    sales_employee_id: Number(v.sales_employee_id),
    contract_date: v.contract_date,
    payment_type: v.payment_type,
    selling_price: v.selling_price.trim(),
    ...(v.discount.trim() !== '' ? { discount: v.discount.trim() } : {}),
    notes: text(v.notes),
  };

  if (v.payment_type === 'cash') {
    return {
      ...base,
      payment: {
        amount: v.payment.amount.trim(),
        payment_date: v.payment.payment_date,
        payment_method: v.payment.payment_method,
        cashbox_id: Number(v.payment.cashbox_id),
        reference: text(v.payment.reference),
      },
    };
  }

  const withDown: ContractPayload = {
    ...base,
    down_payment: v.down_payment.trim(),
    ...(compareMoney(v.down_payment.trim(), 0) > 0
      ? {
          down_payment_receipt: {
            cashbox_id: Number(v.down_payment_receipt.cashbox_id),
            payment_method: v.down_payment_receipt.payment_method,
            reference: text(v.down_payment_receipt.reference),
          },
        }
      : {}),
  };

  if (v.payment_type === 'installment') {
    return {
      ...withDown,
      installment_frequency: v.installment_frequency,
      start_date: v.start_date,
      number_of_installments: Number(v.number_of_installments),
      installments: v.installments.map((r) => ({ amount: r.amount.trim(), due_date: r.due_date })),
    };
  }

  const b = v.bank_financing;
  return {
    ...withDown,
    bank_financing: {
      bank_id: Number(b.bank_id),
      transaction_reference: text(b.transaction_reference),
      application_date: b.application_date,
      expected_amount: b.expected_amount.trim(),
      internal_notes: text(b.internal_notes),
    },
  };
}

/** Form paths that can receive server errors (Laravel paths are the same). */
export const CONTRACT_FORM_FIELDS = [
  'vehicle_id',
  'customer_id',
  'sales_employee_id',
  'contract_date',
  'payment_type',
  'selling_price',
  'discount',
  'notes',
  'payment',
  'payment.amount',
  'payment.payment_date',
  'payment.payment_method',
  'payment.cashbox_id',
  'payment.reference',
  'down_payment',
  'down_payment_receipt',
  'down_payment_receipt.cashbox_id',
  'down_payment_receipt.payment_method',
  'down_payment_receipt.reference',
  'installment_frequency',
  'start_date',
  'number_of_installments',
  'installments',
  'bank_financing',
  'bank_financing.bank_id',
  'bank_financing.transaction_reference',
  'bank_financing.application_date',
  'bank_financing.expected_amount',
  'bank_financing.internal_notes',
] as const;
