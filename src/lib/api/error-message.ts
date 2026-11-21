import { ar } from '@/locales/ar';
import { isApiError } from './errors';

/**
 * User-facing message for any thrown error. Prefers the backend's localized message
 * (it honors Accept-Language) and falls back to our own copy for transport-level failures.
 */
export function getErrorMessage(error: unknown): string {
  if (!isApiError(error)) return ar.errors.generic;

  switch (error.kind) {
    case 'network':
      return ar.errors.network;
    case 'server':
      return ar.errors.server;
    case 'rate_limited':
      return error.message || ar.errors.rateLimited;
    default:
      return error.message || ar.errors.generic;
  }
}
