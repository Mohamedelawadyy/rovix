import { FUEL_TYPES, TRANSMISSIONS, VEHICLE_STATUSES, VEHICLE_TYPES } from './types';

/**
 * Vehicles list state lives in the URL (shareable, survives reload, back/forward works).
 * Only keys the backend allowlists are produced (GET /vehicles, BACKEND_API_REFERENCE.md §11.5);
 * anything else in the URL is ignored instead of triggering a 422.
 */
export const VEHICLE_SORTS = [
  '-created_at',
  'selling_price',
  '-selling_price',
  '-year',
  'year',
  'mileage',
  'stock_number',
] as const;
export type VehicleSort = (typeof VEHICLE_SORTS)[number];

export const PAGE_SIZES = [15, 30, 50, 100] as const;
export const DEFAULT_SORT: VehicleSort = '-created_at';
export const DEFAULT_PAGE_SIZE = 15;

/** A type alias (not an interface) so it is assignable to the client's QueryParams. */
export type VehicleFilters = {
  status?: string;
  brand_id?: number;
  model_id?: number;
  branch_id?: number;
  year?: number;
  fuel_type?: string;
  transmission?: string;
  vehicle_type?: string;
};

export type VehicleListParams = {
  page: number;
  per_page: number;
  sort: VehicleSort;
  search?: string;
  filter: VehicleFilters;
};

const ENUM_FILTERS = {
  status: VEHICLE_STATUSES,
  fuel_type: FUEL_TYPES,
  transmission: TRANSMISSIONS,
  vehicle_type: VEHICLE_TYPES,
} as const;

const ID_FILTERS = ['brand_id', 'model_id', 'branch_id'] as const;

function positiveInt(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const n = Number(value);
  return n > 0 && Number.isSafeInteger(n) ? n : undefined;
}

export function parseVehicleListParams(search: URLSearchParams): VehicleListParams {
  const filter: VehicleFilters = {};

  for (const [key, allowed] of Object.entries(ENUM_FILTERS)) {
    const value = search.get(key);
    if (value && (allowed as readonly string[]).includes(value)) {
      filter[key as keyof typeof ENUM_FILTERS] = value;
    }
  }
  for (const key of ID_FILTERS) {
    const value = positiveInt(search.get(key));
    if (value !== undefined) filter[key] = value;
  }
  const year = positiveInt(search.get('year'));
  if (year !== undefined && year >= 1950 && year <= 2100) filter.year = year;
  // A model only makes sense with its brand.
  if (filter.model_id !== undefined && filter.brand_id === undefined) delete filter.model_id;

  const sort = search.get('sort');
  const perPage = positiveInt(search.get('per_page'));
  const term = search.get('search')?.trim().slice(0, 100);

  return {
    page: positiveInt(search.get('page')) ?? 1,
    per_page: (PAGE_SIZES as readonly number[]).includes(perPage ?? 0)
      ? (perPage as number)
      : DEFAULT_PAGE_SIZE,
    sort: (VEHICLE_SORTS as readonly string[]).includes(sort ?? '')
      ? (sort as VehicleSort)
      : DEFAULT_SORT,
    ...(term ? { search: term } : {}),
    filter,
  };
}

/** Serializes params back to a minimal URL (defaults are omitted). */
export function toSearchParams(params: VehicleListParams): URLSearchParams {
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

export function hasActiveFilters(params: VehicleListParams): boolean {
  return Boolean(params.search) || Object.keys(params.filter).length > 0;
}
