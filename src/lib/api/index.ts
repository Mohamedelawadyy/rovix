import { env } from '@/app/config/env';
import { createApiClient } from './client';
import { apiSession } from './session';

/** Default locale until i18n lands: follows `<html lang>` (ar by default). */
function currentLocale(): string {
  return document.documentElement.lang || 'ar';
}

/** The application's single API client. Feature `api/` modules import this. */
export const api = createApiClient({
  baseUrl: env.apiBaseUrl,
  getToken: () => apiSession.getToken(),
  getLocale: currentLocale,
  onUnauthenticated: (error) => {
    apiSession.notifyUnauthenticated(error);
  },
});

export { createApiClient } from './client';
export type { ApiClient, DownloadResult, RequestOptions } from './client';
export { ApiError, isApiError } from './errors';
export type { ApiErrorKind, FieldErrors } from './errors';
export { apiSession } from './session';
export type { ListParams, Paginated, Pagination, MoneyString } from './types';
