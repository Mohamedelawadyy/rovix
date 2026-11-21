import { api, type Paginated } from '@/lib/api';
import type {
  IdName,
  MovementStatus,
  Vehicle,
  VehicleBrand,
  VehicleHistory,
  VehicleModel,
  VehicleMovement,
} from '../types';
import type { VehicleListParams } from '../list-params';
import type { VehiclePayload } from '../vehicle-form-schema';

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

  /** POST /vehicles (vehicles.create). Stock number is generated when omitted. */
  create: (payload: VehiclePayload) => api.post<Vehicle>('/vehicles', payload),

  /** PUT /vehicles/{id} (vehicles.update + branch). branch_id/purchase_price/status are prohibited. */
  update: (id: number, payload: VehiclePayload) =>
    api.put<Vehicle>(`/vehicles/${String(id)}`, payload),

  /** DELETE /vehicles/{id} — only available / under_maintenance vehicles (409 otherwise). */
  remove: (id: number) => api.delete<null>(`/vehicles/${String(id)}`),

  /** Manual status change: only available ⇄ under_maintenance (others are workflow-driven). */
  changeStatus: (id: number, body: { status: 'available' | 'under_maintenance'; reason: string }) =>
    api.post<Vehicle>(`/vehicles/${String(id)}/status`, body),

  /** POST /vehicles/{id}/transfer — vehicle becomes `transferred` until received or cancelled. */
  transfer: (id: number, body: { to_branch_id: number; notes: string | null }) =>
    api.post<VehicleMovement>(`/vehicles/${String(id)}/transfer`, body),

  /** Receiving needs access to the destination branch. */
  receiveTransfer: (movementId: number) =>
    api.post<VehicleMovement>(`/vehicle-transfers/${String(movementId)}/receive`),

  /** Cancelling needs access to the source branch. */
  cancelTransfer: (movementId: number) =>
    api.post<VehicleMovement>(`/vehicle-transfers/${String(movementId)}/cancel`),

  /** GET /vehicle-transfers — movements touching the user's branches. */
  transfers: (
    params: { page: number; status?: MovementStatus | undefined },
    signal?: AbortSignal,
  ) =>
    api.get<Paginated<VehicleMovement>>('/vehicle-transfers', {
      query: {
        page: params.page,
        per_page: 15,
        sort: '-initiated_at',
        filter: { status: params.status },
      },
      ...(signal ? { signal } : {}),
    }),

  /** Multipart upload (jpg/jpeg/png/webp ≤ 5 MB). */
  uploadImage: (id: number, file: File, isPrimary: boolean) => {
    const form = new FormData();
    form.append('image', file);
    form.append('is_primary', isPrimary ? '1' : '0');
    return api.post<{ id: number; url: string; is_primary: boolean }>(
      `/vehicles/${String(id)}/images`,
      form,
    );
  },

  deleteImage: (id: number, imageId: number) =>
    api.delete<null>(`/vehicles/${String(id)}/images/${String(imageId)}`),

  /** Active suppliers for the form (needs `suppliers.view`). */
  suppliers: (signal?: AbortSignal) =>
    api.get<Paginated<IdName>>('/suppliers', {
      query: { per_page: LOOKUP_PAGE_SIZE, sort: 'name', filter: { status: 'active' } },
      ...(signal ? { signal } : {}),
    }),

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
  suppliers: ['suppliers', 'options'] as const,
  transfers: (params: { page: number; status?: string | undefined }) =>
    ['vehicles', 'transfers', params] as const,
};
