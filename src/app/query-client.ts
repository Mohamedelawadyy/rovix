import { QueryClient } from '@tanstack/react-query';
import { isApiError } from '@/lib/api';

/** Client errors (4xx) and cancellations are never retried; transient failures once. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && !['network', 'server'].includes(error.kind)) return false;
  return failureCount < 1;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        staleTime: 30 * 1000,
        refetchOnWindowFocus: true,
      },
      mutations: {
        // Never auto-retry writes (payments, sales): duplicates are worse than an error.
        retry: false,
      },
    },
  });
}
