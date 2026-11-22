import type { BadgeTone } from '@/components/ui/Badge';
import type { InstallmentFrequency, InstallmentStatus } from './types';

export {
  contractStatusLabels,
  contractStatusTone,
  labelOf,
  paymentMethodLabels,
  paymentTypeLabels,
  transactionCategoryLabels,
} from '@/features/customers/labels';

export const frequencyLabels: Record<InstallmentFrequency, string> = {
  monthly: 'شهري',
  quarterly: 'كل 3 شهور',
  semi_annual: 'كل 6 شهور',
  annual: 'سنوي',
  custom: 'مواعيد مخصصة',
};

export const installmentStatusLabels: Record<InstallmentStatus, string> = {
  pending: 'مستحق',
  partially_paid: 'مدفوع جزئيًا',
  paid: 'مدفوع',
  overdue: 'متأخر',
  cancelled: 'ملغي',
};

export const installmentStatusTone: Record<InstallmentStatus, BadgeTone> = {
  pending: 'neutral',
  partially_paid: 'info',
  paid: 'success',
  overdue: 'danger',
  cancelled: 'neutral',
};

/** BankFinancing FinancingStatus values. */
export const financingStatusLabels: Record<string, string> = {
  new: 'جديد',
  submitted: 'اتقدم للبنك',
  under_review: 'تحت المراجعة',
  additional_documents_required: 'مطلوب مستندات إضافية',
  approved: 'اتوافق عليه',
  rejected: 'مرفوض',
  partially_received: 'اتحصّل جزئيًا',
  fully_received: 'اتحصّل بالكامل',
  cancelled: 'ملغي',
};
