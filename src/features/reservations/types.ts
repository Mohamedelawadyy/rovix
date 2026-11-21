/** Modules/Sales/app/Enums/ReservationStatus.php */
export const RESERVATION_STATUSES = ['active', 'converted', 'released'] as const;
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

/** ReservationResource. */
export interface Reservation {
  id: number;
  number: string;
  vehicle?: { id: number; stock_number: string; vin: string | null };
  customer?: { id: number; name: string; customer_code: string };
  branch_id: number;
  status: ReservationStatus;
  expires_at: string | null;
  notes: string | null;
  sales_contract_id: number | null;
  reserved_by: number | null;
  released_at: string | null;
  release_reason: string | null;
  created_at: string | null;
}

/**
 * An active reservation past its expiry date. Display only: the backend has no expiry job,
 * so such a reservation still holds the vehicle until someone releases it.
 */
export function isOverdue(reservation: Reservation, now = Date.now()): boolean {
  return (
    reservation.status === 'active' &&
    reservation.expires_at !== null &&
    new Date(reservation.expires_at).getTime() < now
  );
}

/** Mirrors ReasonRequest: required, 3–255 characters. */
export function isValidReason(reason: string): boolean {
  const length = reason.trim().length;
  return length >= 3 && length <= 255;
}
