import { api, type Paginated } from '@/lib/api';
import type { CustomerPayload } from '../customer-form-schema';
import type { CustomerListParams } from '../list-params';
import type { Customer, CustomerBalance, CustomerContract, CustomerPayment } from '../types';

const opts = (signal?: AbortSignal) => (signal ? { signal } : {});
const SUB_PAGE_SIZE = 10;

export const customersApi = {
  /** GET /customers — only customers linked to the user's branches. */
  list: (params: CustomerListParams, signal?: AbortSignal) =>
    api.get<Paginated<Customer>>('/customers', { query: params, ...opts(signal) }),

  /**
   * GET /customers/{id}. With `revealNationalId` the backend returns the full national ID only
   * if the user has customers.view-sensitive; otherwise it stays masked.
   */
  get: (id: number, { revealNationalId = false } = {}, signal?: AbortSignal) =>
    api.get<Customer>(`/customers/${String(id)}`, {
      ...(revealNationalId ? { query: { include: 'national_id' } } : {}),
      ...opts(signal),
    }),

  create: (payload: CustomerPayload) => api.post<Customer>('/customers', payload),

  /** PUT /customers/{id}; `branch_id` is prohibited. */
  update: (id: number, payload: CustomerPayload) =>
    api.put<Customer>(`/customers/${String(id)}`, payload),

  remove: (id: number) => api.delete<null>(`/customers/${String(id)}`),

  /**
   * POST /customers/lookup (customers.create, 30/min). Exact national-ID match across branches;
   * a match is linked to `branch_id` so that branch can serve the customer. 404 = no match.
   */
  lookup: (body: { national_id: string; branch_id: number }) =>
    api.post<Customer>('/customers/lookup', body),

  balance: (id: number, signal?: AbortSignal) =>
    api.get<CustomerBalance>(`/customers/${String(id)}/balance`, opts(signal)),

  contracts: (id: number, page: number, signal?: AbortSignal) =>
    api.get<Paginated<CustomerContract>>(`/customers/${String(id)}/contracts`, {
      query: { page, per_page: SUB_PAGE_SIZE, sort: '-contract_date' },
      ...opts(signal),
    }),

  payments: (id: number, page: number, signal?: AbortSignal) =>
    api.get<Paginated<CustomerPayment>>(`/customers/${String(id)}/payments`, {
      query: { page, per_page: SUB_PAGE_SIZE, sort: '-transaction_date' },
      ...opts(signal),
    }),
};

export const customerKeys = {
  all: ['customers'] as const,
  list: (params: CustomerListParams) => ['customers', 'list', params] as const,
  detail: (id: number) => ['customers', 'detail', id] as const,
  /** Unmasked record — kept apart so the masked one is what normally sits in the cache. */
  sensitive: (id: number) => ['customers', 'detail', id, 'sensitive'] as const,
  balance: (id: number) => ['customers', 'detail', id, 'balance'] as const,
  contracts: (id: number, page: number) => ['customers', 'detail', id, 'contracts', page] as const,
  payments: (id: number, page: number) => ['customers', 'detail', id, 'payments', page] as const,
};
