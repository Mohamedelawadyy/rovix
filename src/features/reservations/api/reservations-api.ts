import { api, type Paginated } from '@/lib/api';
import type { Customer } from '@/features/customers/types';
import type { Vehicle } from '@/features/vehicles/types';
import type { ReservationListParams } from '../list-params';
import type { Reservation } from '../types';

const opts = (signal?: AbortSignal) => (signal ? { signal } : {});
const PICKER_PAGE_SIZE = 10;

export interface ReservationPayload {
  vehicle_id: number;
  customer_id: number;
  expires_at: string | null;
  notes: string | null;
}

export const reservationsApi = {
  /** GET /reservations — branch-scoped by the backend. */
  list: (params: ReservationListParams, signal?: AbortSignal) =>
    api.get<Paginated<Reservation>>('/reservations', { query: params, ...opts(signal) }),

  get: (id: number, signal?: AbortSignal) =>
    api.get<Reservation>(`/reservations/${String(id)}`, opts(signal)),

  /**
   * POST /reservations (reservations.create). The vehicle must be `available` (409
   * vehicle_not_available / vehicle_already_sold) and the customer active (409
   * customer_inactive); the vehicle becomes `reserved`.
   */
  create: (payload: ReservationPayload) => api.post<Reservation>('/reservations', payload),

  /** POST /reservations/{id}/release (reservations.cancel). Active only; vehicle → available. */
  release: (id: number, reason: string) =>
    api.post<Reservation>(`/reservations/${String(id)}/release`, { reason }),

  /** Vehicles that can be reserved: available ones in the user's branches. */
  availableVehicles: (search: string, signal?: AbortSignal) =>
    api.get<Paginated<Vehicle>>('/vehicles', {
      query: {
        per_page: PICKER_PAGE_SIZE,
        filter: { status: 'available' },
        ...(search ? { search } : {}),
      },
      ...opts(signal),
    }),

  activeCustomers: (search: string, signal?: AbortSignal) =>
    api.get<Paginated<Customer>>('/customers', {
      query: {
        per_page: PICKER_PAGE_SIZE,
        sort: 'name',
        filter: { status: 'active' },
        ...(search ? { search } : {}),
      },
      ...opts(signal),
    }),
};

export const reservationKeys = {
  all: ['reservations'] as const,
  list: (params: ReservationListParams) => ['reservations', 'list', params] as const,
  detail: (id: number) => ['reservations', 'detail', id] as const,
  vehicleOptions: (search: string) => ['reservations', 'vehicle-options', search] as const,
  customerOptions: (search: string) => ['reservations', 'customer-options', search] as const,
};
