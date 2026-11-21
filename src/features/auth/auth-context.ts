import { createContext, useContext } from 'react';
import type { ApiError } from '@/lib/api';
import type { AuthUser, LoginRequest } from './types';

export type AuthStatus =
  /** Restoring a stored session (waiting for GET /auth/me). */
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  /** A stored session exists but could not be verified (network/server error). */
  | 'error';

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  /** Set when status is 'error'. */
  error: ApiError | null;
  login: (credentials: LoginRequest) => Promise<AuthUser>;
  /** Revokes the token server-side (best effort) and clears local state. */
  logout: () => Promise<void>;
  /** Retries session verification after an 'error' status. */
  retry: () => void;
  can: (permission: string) => boolean;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return value;
}
