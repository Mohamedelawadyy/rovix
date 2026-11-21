import { RESERVATION_STATUSES } from './types';

/**
 * Reservations list state lives in the URL. Only keys GET /reservations allowlists are produced
 * (search: number, customer.name, vehicle.stock_number · filter: status, branch_id ·
 * sort: created_at, expires_at).
 */
export const RESERVATION_SORTS = [
  '-created_at',
  'created_at',
  'expires_at',
  '-expires_at',
] as const;
export type ReservationSort = (typeof RESERVATION_SORTS)[number];

export const PAGE_SIZES = [15, 30, 50, 100] as const;
export const DEFAULT_SORT: ReservationSort = '-created_at';
export const DEFAULT_PAGE_SIZE = 15;

/** A type alias (not an interface) so it is assignable to the client's QueryParams. */
export type ReservationFilters = {
  status?: string;
  branch_id?: number;
};

export type ReservationListParams = {
  page: number;
  per_page: number;
  sort: ReservationSort;
  search?: string;
  filter: ReservationFilters;
};

function positiveInt(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const n = Number(value);
  return n > 0 && Number.isSafeInteger(n) ? n : undefined;
}

export function parseReservationListParams(search: URLSearchParams): ReservationListParams {
  const filter: ReservationFilters = {};
  const status = search.get('status');
  if (status && (RESERVATION_STATUSES as readonly string[]).includes(status)) {
    filter.status = status;
  }
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
    sort: (RESERVATION_SORTS as readonly string[]).includes(sort ?? '')
      ? (sort as ReservationSort)
      : DEFAULT_SORT,
    ...(term ? { search: term } : {}),
    filter,
  };
}

export function toSearchParams(params: ReservationListParams): URLSearchParams {
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

export function hasActiveFilters(params: ReservationListParams): boolean {
  return Boolean(params.search) || Object.keys(params.filter).length > 0;
}
