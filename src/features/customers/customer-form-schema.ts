import { z } from 'zod';
import { ar, interpolate } from '@/locales/ar';
import { CUSTOMER_STATUSES, isRevealedNationalId, type Customer } from './types';

/**
 * Client-side mirror of Modules/Customers/app/Http/Requests/CustomerRequest.php.
 * Instant feedback only; the backend stays authoritative (e.g. national ID uniqueness) and its
 * 422 errors are mapped back onto these fields.
 */
const m = ar.customers.form.validation;

export const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;
export const NATIONAL_ID_PATTERN = /^\d{14}$/;

const text = (max: number) => z.string().trim().max(max, interpolate(m.maxLength, { max }));

export function createCustomerFormSchema(mode: 'create' | 'edit') {
  return z.object({
    name: text(255).min(1, m.required),
    phone: z
      .string()
      .trim()
      .min(1, m.required)
      .max(30, interpolate(m.maxLength, { max: 30 }))
      .refine((v) => PHONE_PATTERN.test(v), m.phone),
    customer_code: text(30),
    email: text(255).refine((v) => v === '' || z.email().safeParse(v).success, m.email),
    national_id: z
      .string()
      .trim()
      .refine((v) => v === '' || NATIONAL_ID_PATTERN.test(v), m.nationalId),
    address: text(255),
    notes: text(2000),
    status: z.enum(CUSTOMER_STATUSES),
    branch_id: mode === 'create' ? z.string().min(1, m.required) : z.string(),
  });
}

export type CustomerFormValues = z.input<ReturnType<typeof createCustomerFormSchema>>;

export const emptyCustomerForm: CustomerFormValues = {
  name: '',
  phone: '',
  customer_code: '',
  email: '',
  national_id: '',
  address: '',
  notes: '',
  status: 'active',
  branch_id: '',
};

/**
 * Prefills the edit form. The national ID is only prefilled when the API returned it unmasked
 * (`?include=national_id` with customers.view-sensitive); a masked value is never put in a field.
 */
export function customerToFormValues(customer: Customer): CustomerFormValues {
  return {
    name: customer.name,
    phone: customer.phone,
    customer_code: customer.customer_code,
    email: customer.email ?? '',
    national_id: isRevealedNationalId(customer.national_id) ? customer.national_id : '',
    address: customer.address ?? '',
    notes: customer.notes ?? '',
    status: customer.status,
    branch_id: customer.branch ? String(customer.branch.id) : '',
  };
}

export interface CustomerPayload {
  name: string;
  phone: string;
  customer_code?: string;
  email: string | null;
  national_id?: string | null;
  address: string | null;
  notes: string | null;
  status: string;
  branch_id?: number;
}

/**
 * Builds the request body.
 * - `branch_id` is create-only (the backend marks it `prohibited` on update).
 * - On edit, `national_id` is sent only when it differs from the prefilled value, so a user who
 *   cannot see the real number never overwrites (or clears) it by saving other changes.
 * - An empty customer code is omitted: the backend generates one.
 */
export function toCustomerPayload(
  values: CustomerFormValues,
  mode: 'create' | 'edit',
  initialNationalId = '',
): CustomerPayload {
  const optional = (v: string) => (v.trim() === '' ? null : v.trim());
  const nationalId = values.national_id.trim();
  const sendNationalId = mode === 'create' ? nationalId !== '' : nationalId !== initialNationalId;

  return {
    name: values.name.trim(),
    phone: values.phone.trim(),
    ...(values.customer_code.trim() ? { customer_code: values.customer_code.trim() } : {}),
    email: optional(values.email),
    ...(sendNationalId ? { national_id: optional(nationalId) } : {}),
    address: optional(values.address),
    notes: optional(values.notes),
    status: values.status,
    ...(mode === 'create' ? { branch_id: Number(values.branch_id) } : {}),
  };
}
