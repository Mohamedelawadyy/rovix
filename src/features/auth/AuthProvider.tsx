import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiSession, isApiError } from '@/lib/api';
import { authApi, authKeys } from './api/auth-api';
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context';
import { can as canFor } from './permissions';
import { REFRESH_CHECK_INTERVAL_MS, shouldRefresh, withRefreshLock } from './session-refresh';
import { TOKEN_STORAGE_KEY, tokenStorage } from './token-storage';
import type { LoginRequest, StoredSession } from './types';

function adoptSession(session: StoredSession | null): StoredSession | null {
  apiSession.setToken(session?.token ?? null);
  return session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  // Synchronous restore so the very first request already carries the token.
  const [session, setSession] = useState<StoredSession | null>(() =>
    adoptSession(tokenStorage.read()),
  );
  // Latest session for event listeners (401 broadcast, storage events, refresh timer).
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const meQuery = useQuery({
    queryKey: authKeys.me,
    queryFn: ({ signal }) => authApi.me(signal),
    enabled: session !== null,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  /** Local sign-out: no API call (used after 401, logout, or another tab signing out). */
  const clearSession = useCallback(() => {
    tokenStorage.clear();
    setSession(adoptSession(null));
    queryClient.clear();
  }, [queryClient]);

  const storeSession = useCallback((next: StoredSession) => {
    tokenStorage.write(next);
    setSession(adoptSession(next));
  }, []);

  // Any 401 from any request ends the session.
  useEffect(
    () =>
      apiSession.onUnauthenticated(() => {
        if (sessionRef.current) clearSession();
      }),
    [clearSession],
  );

  // Keep tabs in sync: sign out / sign in / token renewal in another tab.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== TOKEN_STORAGE_KEY && event.key !== null) return;
      const next = tokenStorage.read();
      if (!next) {
        if (sessionRef.current) clearSession();
        return;
      }
      if (next.token !== sessionRef.current?.token) {
        const wasSignedIn = sessionRef.current !== null;
        setSession(adoptSession(next));
        if (!wasSignedIn) void queryClient.invalidateQueries({ queryKey: authKeys.me });
      }
    }
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
    };
  }, [clearSession, queryClient]);

  // Token renewal before expiry; one tab at a time (Web Locks), others adopt it via storage.
  const authenticated = session !== null && meQuery.isSuccess;
  useEffect(() => {
    if (!authenticated) return;

    async function renewIfDue() {
      await withRefreshLock(async () => {
        const latest = tokenStorage.read();
        if (!latest || !shouldRefresh(latest.expiresAt)) {
          if (latest && latest.token !== sessionRef.current?.token)
            setSession(adoptSession(latest));
          return;
        }
        apiSession.setToken(latest.token);
        const renewed = await authApi.refresh();
        storeSession({ token: renewed.token, expiresAt: renewed.expires_at });
      });
    }

    const run = () => {
      renewIfDue().catch(() => {
        // Failed renewal is not fatal: the current token stays valid until it expires,
        // and a 401 will end the session through the listener above.
      });
    };
    run();
    const timer = window.setInterval(run, REFRESH_CHECK_INTERVAL_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, [authenticated, storeSession]);

  const login = useCallback(
    async (credentials: LoginRequest) => {
      const result = await authApi.login(credentials);
      const next = { token: result.token, expiresAt: result.expires_at };
      apiSession.setToken(next.token);
      // Login does not return permissions: load the full profile before entering the app.
      const user = await queryClient.query({
        queryKey: authKeys.me,
        queryFn: ({ signal }) => authApi.me(signal),
        staleTime: 0,
      });
      storeSession(next);
      return user;
    },
    [queryClient, storeSession],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Best effort: the local session is cleared regardless.
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const { refetch } = meQuery;
  const retry = useCallback(() => {
    void refetch();
  }, [refetch]);

  const value = useMemo<AuthContextValue>(() => {
    const user = session ? (meQuery.data ?? null) : null;
    let status: AuthStatus;
    if (!session) status = 'unauthenticated';
    else if (meQuery.isSuccess) status = 'authenticated';
    else if (
      meQuery.isError &&
      !(isApiError(meQuery.error) && meQuery.error.kind === 'unauthenticated')
    )
      status = 'error';
    else status = 'loading';

    return {
      status,
      user,
      error: status === 'error' && isApiError(meQuery.error) ? meQuery.error : null,
      login,
      logout,
      retry,
      can: (permission) => canFor(user, permission),
    };
  }, [
    session,
    meQuery.data,
    meQuery.isSuccess,
    meQuery.isError,
    meQuery.error,
    login,
    logout,
    retry,
  ]);

  return <AuthContext value={value}>{children}</AuthContext>;
}
