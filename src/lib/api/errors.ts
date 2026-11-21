/**
 * Normalized API error. Every failed request — HTTP error, network failure or abort —
 * is thrown as an ApiError so UI code handles one shape (see BACKEND_API_REFERENCE.md §5).
 */
export type ApiErrorKind =
  /** 422: field errors in `fieldErrors`. */
  | 'validation'
  /** 401: token missing, expired or revoked. */
  | 'unauthenticated'
  /** 403: permission or branch denied. */
  | 'forbidden'
  /** 404 */
  | 'not_found'
  /** 409: business rule violation; `code` holds `errors.code` when present. */
  | 'conflict'
  /** 429 */
  | 'rate_limited'
  /** 5xx or an unreadable response (e.g. proxy error page). */
  | 'server'
  /** The request never got a response (offline, DNS, CORS, backend down). */
  | 'network'
  /** Cancelled through an AbortSignal. Usually ignored by the UI. */
  | 'aborted'
  /** Any other HTTP status (e.g. 415). */
  | 'http';

export type FieldErrors = Record<string, string[]>;

interface ApiErrorInit {
  kind: ApiErrorKind;
  status: number | null;
  message: string;
  fieldErrors?: FieldErrors;
  code?: string | null;
  details?: Record<string, unknown> | null;
  cause?: unknown;
}

export class ApiError extends Error {
  override name = 'ApiError';
  readonly kind: ApiErrorKind;
  /** HTTP status, or null for network/abort errors. */
  readonly status: number | null;
  /** Validation messages keyed by dot-notation field path (`vehicles.0.model_id`). */
  readonly fieldErrors: FieldErrors;
  /** Business-rule code from a 409 (`errors.code`), e.g. `account_disabled`. */
  readonly code: string | null;
  /** Raw `errors` object from the envelope, for anything not covered above. */
  readonly details: Record<string, unknown> | null;

  constructor(init: ApiErrorInit) {
    super(init.message, { cause: init.cause });
    this.kind = init.kind;
    this.status = init.status;
    this.fieldErrors = init.fieldErrors ?? {};
    this.code = init.code ?? null;
    this.details = init.details ?? null;
  }

  /** First message for a field, e.g. to show under an input. */
  fieldError(field: string): string | undefined {
    return this.fieldErrors[field]?.[0];
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function kindFromStatus(status: number): ApiErrorKind {
  switch (status) {
    case 401:
      return 'unauthenticated';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    case 422:
      return 'validation';
    case 429:
      return 'rate_limited';
    default:
      return status >= 500 ? 'server' : 'http';
  }
}

/** Extracts `{ field: string[] }` from a Laravel validation `errors` object, ignoring other shapes. */
export function toFieldErrors(errors: Record<string, unknown> | null | undefined): FieldErrors {
  if (!errors) return {};

  const result: FieldErrors = {};
  for (const [field, messages] of Object.entries(errors)) {
    if (Array.isArray(messages)) {
      const strings = messages.filter((m): m is string => typeof m === 'string');
      if (strings.length > 0) result[field] = strings;
    }
  }
  return result;
}
