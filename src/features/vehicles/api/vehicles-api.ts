import { api, type Paginated } from '@/lib/api';
import type { IdName, Vehicle, VehicleBrand, VehicleHistory, VehicleModel } from '../types';
import type { VehicleListParams } from '../list-params';

const LOOKUP_PAGE_SIZE = 100; // backend maximum

export const vehiclesApi = {
  /** GET /vehicles — branch-scoped by the backend. */
  list: (params: VehicleListParams, signal?: AbortSignal) =>
    api.get<Paginated<Vehicle>>('/vehicles', {
      query: params,
      ...(signal ? { signal } : {}),
    }),

  /** GET /vehicles/{id} — includes supplier and images. 403 for another branch's vehicle. */
  get: (id: number, signal?: AbortSignal) =>
    api.get<Vehicle>(`/vehicles/${String(id)}`, signal ? { signal } : {}),

  /** GET /vehicles/{id}/history — status changes, transfers, and costs (null without view-cost). */
  history: (id: number, signal?: AbortSignal) =>
    api.get<VehicleHistory>(`/vehicles/${String(id)}/history`, signal ? { signal } : {}),

  /** Active brands for filters (catalog is global, not branch-scoped). */
  brands: (signal?: AbortSignal) =>
    api.get<Paginated<VehicleBrand>>('/vehicle-brands', {
      query: { per_page: LOOKUP_PAGE_SIZE, sort: 'name', filter: { is_active: 1 } },
      ...(signal ? { signal } : {}),
    }),

  models: (brandId: number, signal?: AbortSignal) =>
    api.get<Paginated<VehicleModel>>('/vehicle-models', {
      query: {
        per_page: LOOKUP_PAGE_SIZE,
        sort: 'name',
        filter: { brand_id: brandId, is_active: 1 },
      },
      ...(signal ? { signal } : {}),
    }),

  /** GET /branches (needs `branches.view`); returns branches the user can access. */
  branches: (signal?: AbortSignal) =>
    api.get<Paginated<IdName>>('/branches', {
      query: { per_page: LOOKUP_PAGE_SIZE, sort: 'name', filter: { status: 'active' } },
      ...(signal ? { signal } : {}),
    }),
};

export const vehicleKeys = {
  all: ['vehicles'] as const,
  list: (params: VehicleListParams) => ['vehicles', 'list', params] as const,
  detail: (id: number) => ['vehicles', 'detail', id] as const,
  history: (id: number) => ['vehicles', 'detail', id, 'history'] as const,
  brands: ['vehicle-catalog', 'brands'] as const,
  models: (brandId: number) => ['vehicle-catalog', 'models', brandId] as const,
  branches: ['branches', 'options'] as const,
};
