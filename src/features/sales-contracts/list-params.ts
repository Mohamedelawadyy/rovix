import { CONTRACT_STATUSES, PAYMENT_TYPES } from './types';

/**
 * Contracts list state lives in the URL. Only keys GET /sales-contracts allowlists are produced
 * (search: number, customer name/phone, stock number, VIN · filter: status, payment_type,
 * branch_id · sort: number, contract_date, final_amount, created_at · date: contract_date).
 */
export const CONTRACT_SORTS = [
  '-contract_date',
  'contract_date',
  '-final_amount',
  'final_amount',
  '-number',
] as const;
export type ContractSort = (typeof CONTRACT_SORTS)[number];

export const PAGE_SIZES = [15, 30, 50, 100] as const;
export const DEFAULT_SORT: ContractSort = '-contract_date';
export const DEFAULT_PAGE_SIZE = 15;

/** A type alias (not an interface) so it is assignable to the client's QueryParams. */
export type ContractFilters = {
  status?: string;
  payment_type?: string;
  branch_id?: number;
};

export type ContractListParams = {
  page: number;
  per_page: number;
  sort: ContractSort;
  search?: string;
  date_from?: string;
  date_to?: string;
  filter: ContractFilters;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function positiveInt(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const n = Number(value);
  return n > 0 && Number.isSafeInteger(n) ? n : undefined;
}

function isoDate(value: string | null): string | undefined {
  return value && ISO_DATE.test(value) && !Number.isNaN(Date.parse(value)) ? value : undefined;
}

export function parseContractListParams(search: URLSearchParams): ContractListParams {
  const filter: ContractFilters = {};
  const status = search.get('status');
  if (status && (CONTRACT_STATUSES as readonly string[]).includes(status)) filter.status = status;
  const paymentType = search.get('payment_type');
  if (paymentType && (PAYMENT_TYPES as readonly string[]).includes(paymentType)) {
    filter.payment_type = paymentType;
  }
  const branchId = positiveInt(search.get('branch_id'));
  if (branchId !== undefined) filter.branch_id = branchId;

  const sort = search.get('sort');
  const perPage = positiveInt(search.get('per_page'));
  const term = search.get('search')?.trim().slice(0, 100);
  let dateFrom = isoDate(search.get('date_from'));
  let dateTo = isoDate(search.get('date_to'));
  if (dateFrom && dateTo && dateFrom > dateTo) [dateFrom, dateTo] = [dateTo, dateFrom];

  return {
    page: positiveInt(search.get('page')) ?? 1,
    per_page: (PAGE_SIZES as readonly number[]).includes(perPage ?? 0)
      ? (perPage as number)
      : DEFAULT_PAGE_SIZE,
    sort: (CONTRACT_SORTS as readonly string[]).includes(sort ?? '')
      ? (sort as ContractSort)
      : DEFAULT_SORT,
    ...(term ? { search: term } : {}),
    ...(dateFrom ? { date_from: dateFrom } : {}),
    ...(dateTo ? { date_to: dateTo } : {}),
    filter,
  };
}

export function toSearchParams(params: ContractListParams): URLSearchParams {
  const out = new URLSearchParams();
  if (params.search) out.set('search', params.search);
  for (const [key, value] of Object.entries<string | number | undefined>(params.filter)) {
    if (value !== undefined && value !== '') out.set(key, String(value));
  }
  if (params.date_from) out.set('date_from', params.date_from);
  if (params.date_to) out.set('date_to', params.date_to);
  if (params.sort !== DEFAULT_SORT) out.set('sort', params.sort);
  if (params.per_page !== DEFAULT_PAGE_SIZE) out.set('per_page', String(params.per_page));
  if (params.page > 1) out.set('page', String(params.page));
  return out;
}

export function hasActiveFilters(params: ContractListParams): boolean {
  return (
    Boolean(params.search || params.date_from || params.date_to) ||
    Object.keys(params.filter).length > 0
  );
}
