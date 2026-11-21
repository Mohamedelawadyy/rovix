/**
 * Wire types for the Laravel API (see BACKEND_API_REFERENCE.md §2, §6).
 */

/** Every JSON response: `{ success, message, data, errors }`. */
export interface ApiEnvelope<T> {
  success: boolean;
  message: string | null;
  data: T;
  errors: Record<string, unknown> | null;
}

export interface Pagination {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

/** `data` of every paginated list endpoint. */
export interface Paginated<T> {
  items: T[];
  pagination: Pagination;
}

/** Money as sent by the backend: decimal string with 2 places, e.g. `"125000.00"`. */
export type MoneyString = string;

/** Query value accepted by the query-string builder. `null`/`undefined`/`''` are omitted. */
export type QueryValue = string | number | boolean | null | undefined;

export type QueryParams = Record<
  string,
  QueryValue | readonly QueryValue[] | Record<string, QueryValue | readonly QueryValue[]>
>;

/** Standard list parameters understood by the backend `ListQuery` (§6). */
export interface ListParams {
  page?: number;
  per_page?: number;
  search?: string;
  /** `sort=column` ascending, `sort=-column` descending. */
  sort?: string;
  date_from?: string;
  date_to?: string;
  /** Sent as `filter[key]=a,b`. Only allowlisted keys per endpoint (unknown keys → 422). */
  filter?: Record<string, QueryValue | readonly QueryValue[]>;
}
