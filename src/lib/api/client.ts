import { filenameFromContentDisposition } from './content-disposition';
import { ApiError, kindFromStatus, toFieldErrors } from './errors';
import { buildQueryString } from './query-string';
import type { ApiEnvelope, QueryParams } from './types';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions {
  query?: QueryParams;
  /** Plain objects are sent as JSON; FormData as multipart (browser sets the boundary). */
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

export interface DownloadResult {
  blob: Blob;
  filename: string | null;
  contentType: string | null;
}

export interface ApiClientConfig {
  /** e.g. `/api/v1` (proxied in dev) or `https://api.example.com/api/v1`. */
  baseUrl: string;
  /** Current bearer token, or null when signed out. */
  getToken: () => string | null;
  /** Response language sent as Accept-Language (`ar` | `en`). */
  getLocale: () => string;
  /** Called on every 401 so the auth layer can clear the session. */
  onUnauthenticated?: (error: ApiError) => void;
  /** Injected for tests; defaults to the global fetch. */
  fetch?: typeof fetch;
}

export interface ApiClient {
  request<T>(method: HttpMethod, path: string, options?: RequestOptions): Promise<T>;
  get<T>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<T>;
  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T>;
  put<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T>;
  delete<T>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<T>;
  /** Authenticated binary download (documents, report exports). */
  download(path: string, options?: Omit<RequestOptions, 'body'>): Promise<DownloadResult>;
}

const FALLBACK_MESSAGES: Record<string, string> = {
  network: 'Unable to reach the server. Check your connection and try again.',
  server: 'An unexpected server error occurred. Please try again later.',
  default: 'The request failed.',
};

function isEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return typeof value === 'object' && value !== null && 'success' in value && 'data' in value;
}

async function readJson(response: Response): Promise<unknown> {
  const type = response.headers.get('Content-Type') ?? '';
  if (!type.includes('application/json')) return undefined;
  try {
    return (await response.json()) as unknown;
  } catch {
    return undefined;
  }
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  const baseUrl = config.baseUrl.replace(/\/+$/, '');

  function resolveUrl(path: string, query?: QueryParams): string {
    const url = `${baseUrl}/${path.replace(/^\/+/, '')}${buildQueryString(query)}`;
    // Relative bases (dev proxy) are resolved against the page origin; Node's fetch needs absolute URLs.
    return /^https?:\/\//i.test(url) ? url : new URL(url, globalThis.location.origin).toString();
  }

  function buildHeaders(options: RequestOptions, accept: string): Headers {
    const headers = new Headers(options.headers);
    headers.set('Accept', accept);
    headers.set('Accept-Language', config.getLocale());

    const token = config.getToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);

    if (options.body !== undefined && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    return headers;
  }

  async function send(
    method: HttpMethod,
    path: string,
    options: RequestOptions,
    accept: string,
  ): Promise<Response> {
    const { body } = options;
    const init: RequestInit = {
      method,
      headers: buildHeaders(options, accept),
      // Token auth only: the backend does not support credentialed CORS (supports_credentials=false).
      credentials: 'omit',
    };
    if (options.signal) init.signal = options.signal;
    if (body !== undefined) init.body = body instanceof FormData ? body : JSON.stringify(body);

    try {
      return await (config.fetch ?? fetch)(resolveUrl(path, options.query), init);
    } catch (cause) {
      if (
        options.signal?.aborted ||
        (cause instanceof DOMException && cause.name === 'AbortError')
      ) {
        throw new ApiError({ kind: 'aborted', status: null, message: 'Request aborted.', cause });
      }
      throw new ApiError({
        kind: 'network',
        status: null,
        message: FALLBACK_MESSAGES.network ?? '',
        cause,
      });
    }
  }

  async function toError(response: Response): Promise<ApiError> {
    const payload = await readJson(response);
    const envelope = isEnvelope(payload) ? payload : null;
    const kind = kindFromStatus(response.status);
    const errors = envelope?.errors ?? null;
    const code = typeof errors?.code === 'string' ? errors.code : null;

    const error = new ApiError({
      kind,
      status: response.status,
      message:
        envelope?.message ||
        (kind === 'server' ? FALLBACK_MESSAGES.server : FALLBACK_MESSAGES.default) ||
        '',
      fieldErrors: kind === 'validation' ? toFieldErrors(errors) : {},
      code,
      details: errors,
    });

    if (kind === 'unauthenticated') config.onUnauthenticated?.(error);
    return error;
  }

  async function request<T>(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const response = await send(method, path, options, 'application/json');

    if (!response.ok) throw await toError(response);
    if (response.status === 204) return undefined as T;

    const payload = await readJson(response);
    if (!isEnvelope(payload)) {
      throw new ApiError({
        kind: 'server',
        status: response.status,
        message: FALLBACK_MESSAGES.server ?? '',
      });
    }
    return payload.data as T;
  }

  async function download(
    path: string,
    options: Omit<RequestOptions, 'body'> = {},
  ): Promise<DownloadResult> {
    const response = await send('GET', path, options, '*/*');
    if (!response.ok) throw await toError(response);

    return {
      blob: await response.blob(),
      filename: filenameFromContentDisposition(response.headers.get('Content-Disposition')),
      contentType: response.headers.get('Content-Type'),
    };
  }

  return {
    request,
    get: <T>(path: string, options?: Omit<RequestOptions, 'body'>) =>
      request<T>('GET', path, options),
    post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
      request<T>('POST', path, { ...options, body }),
    put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
      request<T>('PUT', path, { ...options, body }),
    delete: <T>(path: string, options?: Omit<RequestOptions, 'body'>) =>
      request<T>('DELETE', path, options),
    download,
  };
}
