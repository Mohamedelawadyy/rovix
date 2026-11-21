import type { ApiError } from './errors';

/**
 * Holds the bearer token for the API client and broadcasts 401s.
 *
 * Memory only for now: where the token is persisted (localStorage vs sessionStorage vs
 * backend cookie auth) is an open decision for FE-006, which will build on this module.
 */
let token: string | null = null;
const unauthenticatedListeners = new Set<(error: ApiError) => void>();

export const apiSession = {
  getToken(): string | null {
    return token;
  },

  setToken(value: string | null): void {
    token = value;
  },

  /** Subscribe to 401 responses. Returns an unsubscribe function. */
  onUnauthenticated(listener: (error: ApiError) => void): () => void {
    unauthenticatedListeners.add(listener);
    return () => unauthenticatedListeners.delete(listener);
  },

  notifyUnauthenticated(error: ApiError): void {
    for (const listener of unauthenticatedListeners) listener(error);
  },
};
