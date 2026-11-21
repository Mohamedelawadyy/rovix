import { api } from '@/lib/api';
import type {
  AuthUser,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  ResetPasswordRequest,
  TokenResponse,
} from '../types';

export const authApi = {
  login: (body: LoginRequest) => api.post<LoginResponse>('/auth/login', body),

  me: (signal?: AbortSignal) => api.get<AuthUser>('/auth/me', signal ? { signal } : {}),

  /** Exchanges the current token for a new one; the old token is deleted server-side. */
  refresh: () => api.post<TokenResponse>('/auth/refresh'),

  logout: () => api.post<null>('/auth/logout'),

  forgotPassword: (body: ForgotPasswordRequest) => api.post<null>('/auth/forgot-password', body),

  resetPassword: (body: ResetPasswordRequest) => api.post<null>('/auth/reset-password', body),
};

export const authKeys = {
  me: ['auth', 'me'] as const,
};
