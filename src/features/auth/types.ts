/** `UserResource` from the backend (BACKEND_API_REFERENCE.md §3). */
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  is_active: boolean;
  locale: 'ar' | 'en';
  last_login_at: string | null;
  roles?: string[];
  /** Only present on GET /auth/me. */
  permissions?: string[];
  branches?: { id: number; name: string; code: string }[];
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  device_name?: string;
}

export interface TokenResponse {
  token: string;
  token_type: 'Bearer';
  /** ISO-8601, or null when the backend has no expiration configured. */
  expires_at: string | null;
}

export interface LoginResponse extends TokenResponse {
  /** Login does not include permissions; GET /auth/me does. */
  user: AuthUser;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  token: string;
  password: string;
  password_confirmation: string;
}

/** What is persisted between reloads. */
export interface StoredSession {
  token: string;
  expiresAt: string | null;
}
