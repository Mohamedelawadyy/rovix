import { shouldRetry } from '@/app/query-client';
import { ApiError } from '@/lib/api';
import { getErrorMessage } from '@/lib/api/error-message';
import { ar, interpolate } from '@/locales/ar';
import { can, canAccessAllBranches, canAny, isSuperAdmin } from './permissions';
import { safeRedirectPath } from './redirect';
import { REFRESH_THRESHOLD_MS, shouldRefresh } from './session-refresh';
import { parseStoredSession, TOKEN_STORAGE_KEY, tokenStorage } from './token-storage';
import type { AuthUser } from './types';

const NOW = Date.parse('2026-11-21T12:00:00Z');

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 1,
    name: 'U',
    email: 'u@x.co',
    phone: null,
    is_active: true,
    locale: 'ar',
    last_login_at: null,
    created_at: '',
    roles: ['Sales Employee'],
    permissions: ['vehicles.view', 'customers.create'],
    ...overrides,
  };
}

describe('token storage', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('round-trips a session through localStorage', () => {
    tokenStorage.write({ token: 'abc', expiresAt: '2099-01-01T00:00:00Z' });
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toContain('abc');
    expect(tokenStorage.read()).toEqual({ token: 'abc', expiresAt: '2099-01-01T00:00:00Z' });
    tokenStorage.clear();
    expect(tokenStorage.read()).toBeNull();
  });

  it('accepts tokens without expiry', () => {
    expect(parseStoredSession(JSON.stringify({ token: 't', expiresAt: null }))).toEqual({
      token: 't',
      expiresAt: null,
    });
  });

  it('discards expired, corrupt or malformed values', () => {
    expect(
      parseStoredSession(JSON.stringify({ token: 't', expiresAt: '2026-11-21T11:59:59Z' }), NOW),
    ).toBeNull();
    expect(parseStoredSession('{not json')).toBeNull();
    expect(parseStoredSession(JSON.stringify({ token: '', expiresAt: null }))).toBeNull();
    expect(parseStoredSession(JSON.stringify({ token: 1 }))).toBeNull();
    expect(parseStoredSession(null)).toBeNull();
  });

  it('removes an invalid stored value when reading', () => {
    localStorage.setItem(TOKEN_STORAGE_KEY, 'garbage');
    expect(tokenStorage.read()).toBeNull();
    expect(localStorage.getItem(TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('survives blocked storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    expect(tokenStorage.read()).toBeNull();
    expect(() => {
      tokenStorage.write({ token: 't', expiresAt: null });
    }).not.toThrow();
  });
});

describe('permissions', () => {
  it('checks permissions from /auth/me', () => {
    expect(can(user(), 'vehicles.view')).toBe(true);
    expect(can(user(), 'vehicles.view-cost')).toBe(false);
    expect(canAny(user(), ['roles.view', 'customers.create'])).toBe(true);
    expect(can(null, 'vehicles.view')).toBe(false);
  });

  it('lets Super Admin pass every check (backend Gate::before)', () => {
    const admin = user({ roles: ['Super Admin'], permissions: [] });
    expect(isSuperAdmin(admin)).toBe(true);
    expect(can(admin, 'anything.at-all')).toBe(true);
    expect(canAccessAllBranches(admin)).toBe(true);
  });

  it('detects all-branch access from branches.access-all', () => {
    expect(canAccessAllBranches(user())).toBe(false);
    expect(canAccessAllBranches(user({ permissions: ['branches.access-all'] }))).toBe(true);
  });
});

describe('session refresh timing', () => {
  it('renews only inside the threshold', () => {
    expect(shouldRefresh(null, NOW)).toBe(false);
    expect(shouldRefresh('invalid', NOW)).toBe(false);
    expect(shouldRefresh(new Date(NOW + REFRESH_THRESHOLD_MS + 60_000).toISOString(), NOW)).toBe(
      false,
    );
    expect(shouldRefresh(new Date(NOW + REFRESH_THRESHOLD_MS - 60_000).toISOString(), NOW)).toBe(
      true,
    );
  });
});

describe('safeRedirectPath', () => {
  it.each([
    ['/vehicles?page=2', '/vehicles?page=2'],
    [null, '/'],
    ['', '/'],
    ['vehicles', '/'],
    ['//evil.example.com', '/'],
    ['/\\evil.example.com', '/'],
    ['https://evil.example.com', '/'],
  ])('%s → %s', (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });
});

describe('error messages and retries', () => {
  const error = (kind: ApiError['kind'], message = '') =>
    new ApiError({ kind, status: null, message });

  it('maps transport errors to our copy and keeps backend messages otherwise', () => {
    expect(getErrorMessage(error('network', 'x'))).toBe(ar.errors.network);
    expect(getErrorMessage(error('server', 'x'))).toBe(ar.errors.server);
    expect(getErrorMessage(error('forbidden', 'ممنوع'))).toBe('ممنوع');
    expect(getErrorMessage(error('rate_limited'))).toBe(ar.errors.rateLimited);
    expect(getErrorMessage(new Error('boom'))).toBe(ar.errors.generic);
  });

  it('retries only transient failures, once', () => {
    expect(shouldRetry(0, error('network'))).toBe(true);
    expect(shouldRetry(0, error('server'))).toBe(true);
    expect(shouldRetry(1, error('server'))).toBe(false);
    expect(shouldRetry(0, error('validation'))).toBe(false);
    expect(shouldRetry(0, error('unauthenticated'))).toBe(false);
  });

  it('interpolates placeholders', () => {
    expect(interpolate('أهلًا، {{name}}', { name: 'Ali' })).toBe('أهلًا، Ali');
    expect(interpolate('{{missing}}', {})).toBe('{{missing}}');
  });
});
