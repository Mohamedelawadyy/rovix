import type { MoneyString } from '@/lib/api';
import type { ContractStatus, CustomerPayment, PaymentType } from '@/features/customers/types';

export {
  CONTRACT_STATUSES,
  PAYMENT_TYPES,
  type ContractStatus,
  type PaymentType,
} from '@/features/customers/types';

/** Installments module enum (enabled subset comes from GET /settings/lookups). */
export const INSTALLMENT_FREQUENCIES = [
  'monthly',
  'quarterly',
  'semi_annual',
  'annual',
  'custom',
] as const;
export type InstallmentFrequency = (typeof INSTALLMENT_FREQUENCIES)[number];

export const INSTALLMENT_STATUSES = [
  'pending',
  'partially_paid',
  'paid',
  'overdue',
  'cancelled',
] as const;
export type InstallmentStatus = (typeof INSTALLMENT_STATUSES)[number];

export interface InstallmentPlanSummary {
  down_payment: MoneyString | null;
  remaining_balance: MoneyString | null;
  number_of_installments: number | null;
  installment_frequency: string | null;
  start_date: string | null;
  installments: {
    id: number;
    installment_number: number;
    amount: MoneyString;
    due_date: string;
    paid_amount: MoneyString;
    remaining_amount: MoneyString;
    status: InstallmentStatus;
  }[];
}

export interface BankFinancingSummary {
  application_id: number;
  number: string;
  bank: { id: number; name: string } | null;
  transaction_reference: string | null;
  application_date: string | null;
  status: string;
  expected_amount: MoneyString;
  approved_amount: MoneyString | null;
  received_amount: MoneyString;
  remaining_amount: MoneyString;
}

/** SalesContractResource (detail includes `payment_plan` and `status_history`). */
export interface SalesContract {
  id: number;
  number: string;
  customer?: { id: number; name: string; customer_code: string; phone: string };
  vehicle?: {
    id: number;
    stock_number: string;
    vin: string | null;
    brand: string | null;
    model: string | null;
    year: number;
  };
  branch?: { id: number; name: string };
  sales_employee?: { id: number; name: string; employee_code: string };
  contract_date: string | null;
  payment_type: PaymentType;
  selling_price: MoneyString;
  discount: MoneyString;
  final_amount: MoneyString;
  down_payment: MoneyString;
  paid_amount: MoneyString;
  outstanding_amount: MoneyString;
  currency: string;
  status: ContractStatus;
  notes: string | null;
  reservation_id: number | null;
  /** Installment plan, bank financing summary, `[]` when none, null for cash. */
  payment_plan?: InstallmentPlanSummary | BankFinancingSummary | [] | null;
  status_history?: {
    from_status: string | null;
    to_status: string;
    reason: string | null;
    changed_by: number | null;
    created_at: string | null;
  }[];
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string | null;
}

/** GET /sales-contracts/{id}/payments */
export interface ContractPayments {
  final_amount: MoneyString;
  paid_amount: MoneyString;
  outstanding_amount: MoneyString;
  transactions: (CustomerPayment & { description?: string | null })[];
}

/** GET /settings/lookups */
export interface FormLookups {
  currency: string;
  payment_methods: string[];
  installment_frequencies: string[];
}

export function isInstallmentPlan(
  plan: SalesContract['payment_plan'],
): plan is InstallmentPlanSummary {
  return !!plan && !Array.isArray(plan) && 'installments' in plan;
}

export function isFinancingSummary(
  plan: SalesContract['payment_plan'],
): plan is BankFinancingSummary {
  return !!plan && !Array.isArray(plan) && 'application_id' in plan;
}
