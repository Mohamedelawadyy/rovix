import type { BadgeTone } from '@/components/ui/Badge';
import type {
  ContractStatus,
  CustomerStatus,
  PaymentMethod,
  PaymentType,
  TransactionCategory,
} from './types';

/** Arabic labels for backend enum values (the API returns untranslated snake_case values). */
export const customerStatusLabels: Record<CustomerStatus, string> = {
  active: 'نشط',
  inactive: 'غير نشط',
};

export const customerStatusTone: Record<CustomerStatus, BadgeTone> = {
  active: 'success',
  inactive: 'neutral',
};

export const contractStatusLabels: Record<ContractStatus, string> = {
  active: 'ساري',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

export const contractStatusTone: Record<ContractStatus, BadgeTone> = {
  active: 'info',
  completed: 'success',
  cancelled: 'neutral',
};

export const paymentTypeLabels: Record<PaymentType, string> = {
  cash: 'كاش',
  installment: 'تقسيط',
  bank_financing: 'تمويل بنكي',
};

export const transactionCategoryLabels: Record<TransactionCategory, string> = {
  sale_payment: 'دفعة بيع',
  down_payment: 'مقدم',
  installment_payment: 'قسط',
  bank_financing: 'تمويل بنكي',
  supplier_payment: 'دفعة مورد',
  vehicle_cost: 'تكلفة عربية',
  expense: 'مصروف',
  commission: 'عمولة',
  customer_refund: 'مرتجع للعميل',
  supplier_refund: 'مرتجع من مورد',
  cashbox_transfer: 'تحويل بين الخزن',
  reversal: 'عكس حركة',
  other: 'أخرى',
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'كاش',
  bank_transfer: 'تحويل بنكي',
  cheque: 'شيك',
  card: 'كارت',
  mobile_wallet: 'محفظة موبايل',
};

/** Unknown values (e.g. a method added later in settings) fall back to the raw value. */
export function labelOf<T extends string>(labels: Record<T, string>, value: string): string {
  return (labels as Record<string, string>)[value] ?? value;
}
