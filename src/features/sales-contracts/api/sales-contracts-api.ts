import { api, type MoneyString, type Paginated } from '@/lib/api';
import type { CustomerPayment } from '@/features/customers/types';
import type { Reservation } from '@/features/reservations/types';
import type { Vehicle } from '@/features/vehicles/types';
import type { ContractPayload } from '../contract-form-schema';
import type { ContractListParams } from '../list-params';
import type { ContractPayments, FormLookups, SalesContract } from '../types';

const opts = (signal?: AbortSignal) => (signal ? { signal } : {});
const LOOKUP_PAGE_SIZE = 100;

export interface PaymentInput {
  amount: MoneyString;
  cashbox_id: number;
  payment_method: string;
  payment_date: string;
  reference: string | null;
  notes: string | null;
}

export interface IdNameCode {
  id: number;
  name: string;
  code?: string | null;
  employee_code?: string;
  user_id?: number | null;
  branch?: { id: number; name: string };
}

export const salesContractsApi = {
  list: (params: ContractListParams, signal?: AbortSignal) =>
    api.get<Paginated<SalesContract>>('/sales-contracts', { query: params, ...opts(signal) }),

  /** Includes `payment_plan` and `status_history`. */
  get: (id: number, signal?: AbortSignal) =>
    api.get<SalesContract>(`/sales-contracts/${String(id)}`, opts(signal)),

  /**
   * POST /sales-contracts (sales-contracts.create, 30/min). Atomic: contract, vehicle → sold,
   * payment plan and the initial receipt. 409 codes include vehicle_already_sold,
   * vehicle_reserved_for_other_customer, invalid_discount, invalid_down_payment,
   * installment_schedule_mismatch, financing_exceeds_contract, sales_employee_not_eligible.
   */
  create: (payload: ContractPayload) => api.post<SalesContract>('/sales-contracts', payload),

  /** sales-contracts.cancel. Received money is NOT refunded automatically. */
  cancel: (id: number, reason: string) =>
    api.post<SalesContract>(`/sales-contracts/${String(id)}/cancel`, { reason }),

  payments: (id: number, signal?: AbortSignal) =>
    api.get<ContractPayments>(`/sales-contracts/${String(id)}/payments`, opts(signal)),

  /** Cash and bank-financing contracts only (treasury.create). 409 contract_overpayment. */
  recordPayment: (id: number, body: PaymentInput) =>
    api.post<{ receipt: CustomerPayment; contract: SalesContract }>(
      `/sales-contracts/${String(id)}/payments`,
      body,
    ),

  lookups: (signal?: AbortSignal) => api.get<FormLookups>('/settings/lookups', opts(signal)),

  /** Sellable: available, or reserved (only to the reserving customer). */
  sellableVehicles: (search: string, signal?: AbortSignal) =>
    api.get<Paginated<Vehicle>>('/vehicles', {
      query: {
        per_page: 10,
        filter: { status: 'available,reserved' },
        ...(search ? { search } : {}),
      },
      ...opts(signal),
    }),

  activeReservationFor: (vehicleId: number, signal?: AbortSignal) =>
    api.get<Paginated<Reservation>>('/reservations', {
      query: { per_page: 1, filter: { vehicle_id: vehicleId, status: 'active' } },
      ...opts(signal),
    }),

  /** employees.view. Only active employees of the vehicle's branch can sign a contract. */
  salesEmployees: (branchId: number, signal?: AbortSignal) =>
    api.get<Paginated<IdNameCode>>('/employees', {
      query: {
        per_page: LOOKUP_PAGE_SIZE,
        sort: 'name',
        filter: { branch_id: branchId, status: 'active' },
      },
      ...opts(signal),
    }),

  /** cashboxes.view — branch-scoped by the backend. */
  cashboxes: (signal?: AbortSignal) =>
    api.get<Paginated<IdNameCode>>('/cashboxes', {
      query: { per_page: LOOKUP_PAGE_SIZE, sort: 'name', filter: { status: 'active' } },
      ...opts(signal),
    }),

  /** banks.view or bank-financing.view. Raw array (not paginated). */
  banks: (signal?: AbortSignal) =>
    api.get<(IdNameCode & { is_active: boolean })[]>('/banks', opts(signal)),
};

export const contractKeys = {
  all: ['sales-contracts'] as const,
  list: (params: ContractListParams) => ['sales-contracts', 'list', params] as const,
  detail: (id: number) => ['sales-contracts', 'detail', id] as const,
  payments: (id: number) => ['sales-contracts', 'detail', id, 'payments'] as const,
  lookups: ['settings', 'lookups'] as const,
  vehicleOptions: (search: string) => ['sales-contracts', 'vehicle-options', search] as const,
  reservationFor: (vehicleId: number) => ['reservations', 'active-for-vehicle', vehicleId] as const,
  employees: (branchId: number) => ['employees', 'sales', branchId] as const,
  cashboxes: ['cashboxes', 'options'] as const,
  banks: ['banks', 'options'] as const,
};
