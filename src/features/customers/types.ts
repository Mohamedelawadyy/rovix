import type { MoneyString } from '@/lib/api';

/** Values from Modules/Customers (status check constraint) and Modules/Sales|Treasury enums. */
export const CUSTOMER_STATUSES = ['active', 'inactive'] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

export const CONTRACT_STATUSES = ['active', 'completed', 'cancelled'] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const PAYMENT_TYPES = ['cash', 'installment', 'bank_financing'] as const;
export type PaymentType = (typeof PAYMENT_TYPES)[number];

export const TRANSACTION_CATEGORIES = [
  'sale_payment',
  'down_payment',
  'installment_payment',
  'bank_financing',
  'supplier_payment',
  'vehicle_cost',
  'expense',
  'commission',
  'customer_refund',
  'supplier_refund',
  'cashbox_transfer',
  'reversal',
  'other',
] as const;
export type TransactionCategory = (typeof TRANSACTION_CATEGORIES)[number];

export const PAYMENT_METHODS = [
  'cash',
  'bank_transfer',
  'cheque',
  'card',
  'mobile_wallet',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** CustomerResource. `national_id` is masked (`**********1234`) unless explicitly revealed. */
export interface Customer {
  id: number;
  customer_code: string;
  name: string;
  phone: string;
  email: string | null;
  national_id: string | null;
  address: string | null;
  notes: string | null;
  status: CustomerStatus;
  branch?: { id: number; name: string };
  created_at: string | null;
}

/** GET /customers/{id}/balance — totals over the customer's non-cancelled contracts. */
export interface CustomerBalance {
  customer_id: number;
  contracts_count: number;
  total_contract_amount: MoneyString;
  total_paid: MoneyString;
  outstanding_balance: MoneyString;
}

/** SalesContractResource as returned by /customers/{id}/contracts. */
export interface CustomerContract {
  id: number;
  number: string;
  vehicle?: {
    id: number;
    stock_number: string;
    vin: string | null;
    brand: string | null;
    model: string | null;
    year: number;
  };
  branch?: { id: number; name: string };
  contract_date: string | null;
  payment_type: PaymentType;
  final_amount: MoneyString;
  paid_amount: MoneyString;
  outstanding_amount: MoneyString;
  status: ContractStatus;
}

/** TreasuryTransactionResource as returned by /customers/{id}/payments. */
export interface CustomerPayment {
  id: number;
  number: string;
  type: 'receipt' | 'payment';
  category: TransactionCategory;
  amount: MoneyString;
  payment_method: string;
  transaction_date: string | null;
  cashbox?: { id: number; name: string; code: string };
  related: { type: string; id: number } | null;
  reference: string | null;
  status: 'posted' | 'reversed';
}

/** A national ID the backend returned unmasked (14 digits, no `*`). */
export function isRevealedNationalId(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^\d{14}$/.test(value);
}
