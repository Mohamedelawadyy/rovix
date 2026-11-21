import type { StoredSession } from './types';

/**
 * Persists the session in localStorage (decision recorded in FE-006).
 * Trade-off: survives reloads and is shared across tabs, but any XSS can read it — keep a
 * strict CSP and never render untrusted HTML.
 */
export const TOKEN_STORAGE_KEY = 'abo-ali.auth.session';

function storage(): Storage | null {
  try {
    return globalThis.localStorage;
  } catch {
    // Access can throw (privacy mode, blocked storage).
    return null;
  }
}

function isStoredSession(value: unknown): value is StoredSession {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.token === 'string' &&
    candidate.token.length > 0 &&
    (candidate.expiresAt === null || typeof candidate.expiresAt === 'string')
  );
}

export function isExpired(session: StoredSession, now = Date.now()): boolean {
  if (session.expiresAt === null) return false;
  const expires = Date.parse(session.expiresAt);
  return Number.isNaN(expires) || expires <= now;
}

/** Parses a raw stored value; invalid or expired sessions are treated as absent. */
export function parseStoredSession(raw: string | null, now = Date.now()): StoredSession | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return isStoredSession(value) && !isExpired(value, now) ? value : null;
  } catch {
    return null;
  }
}

export const tokenStorage = {
  read(now = Date.now()): StoredSession | null {
    const store = storage();
    if (!store) return null;

    try {
      const session = parseStoredSession(store.getItem(TOKEN_STORAGE_KEY), now);
      if (!session) store.removeItem(TOKEN_STORAGE_KEY);
      return session;
    } catch {
      return null;
    }
  },

  write(session: StoredSession): void {
    try {
      storage()?.setItem(TOKEN_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Quota or blocked storage: the session still works until reload.
    }
  },

  clear(): void {
    try {
      storage()?.removeItem(TOKEN_STORAGE_KEY);
    } catch {
      // Nothing to clear.
    }
  },
};
