import { CUSTOMER_STATUSES } from './types';

/**
 * Customers list state lives in the URL. Only keys GET /customers allowlists are produced
 * (search: name, code, phone, email · filter: status, branch_id · sort: name, customer_code,
 * created_at); anything else in the URL is ignored instead of triggering a 422.
 */
export const CUSTOMER_SORTS = ['-created_at', 'created_at', 'name', 'customer_code'] as const;
export type CustomerSort = (typeof CUSTOMER_SORTS)[number];

export const PAGE_SIZES = [15, 30, 50, 100] as const;
export const DEFAULT_SORT: CustomerSort = '-created_at';
export const DEFAULT_PAGE_SIZE = 15;

/** A type alias (not an interface) so it is assignable to the client's QueryParams. */
export type CustomerFilters = {
  status?: string;
  branch_id?: number;
};

export type CustomerListParams = {
  page: number;
  per_page: number;
  sort: CustomerSort;
  search?: string;
  filter: CustomerFilters;
};

function positiveInt(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const n = Number(value);
  return n > 0 && Number.isSafeInteger(n) ? n : undefined;
}

export function parseCustomerListParams(search: URLSearchParams): CustomerListParams {
  const filter: CustomerFilters = {};
  const status = search.get('status');
  if (status && (CUSTOMER_STATUSES as readonly string[]).includes(status)) filter.status = status;
  const branchId = positiveInt(search.get('branch_id'));
  if (branchId !== undefined) filter.branch_id = branchId;

  const sort = search.get('sort');
  const perPage = positiveInt(search.get('per_page'));
  const term = search.get('search')?.trim().slice(0, 100);

  return {
    page: positiveInt(search.get('page')) ?? 1,
    per_page: (PAGE_SIZES as readonly number[]).includes(perPage ?? 0)
      ? (perPage as number)
      : DEFAULT_PAGE_SIZE,
    sort: (CUSTOMER_SORTS as readonly string[]).includes(sort ?? '')
      ? (sort as CustomerSort)
      : DEFAULT_SORT,
    ...(term ? { search: term } : {}),
    filter,
  };
}

/** Serializes params back to a minimal URL (defaults are omitted). */
export function toSearchParams(params: CustomerListParams): URLSearchParams {
  const out = new URLSearchParams();
  if (params.search) out.set('search', params.search);
  for (const [key, value] of Object.entries<string | number | undefined>(params.filter)) {
    if (value !== undefined && value !== '') out.set(key, String(value));
  }
  if (params.sort !== DEFAULT_SORT) out.set('sort', params.sort);
  if (params.per_page !== DEFAULT_PAGE_SIZE) out.set('per_page', String(params.per_page));
  if (params.page > 1) out.set('page', String(params.page));
  return out;
}

export function hasActiveFilters(params: CustomerListParams): boolean {
  return Boolean(params.search) || Object.keys(params.filter).length > 0;
}
