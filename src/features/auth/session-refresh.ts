/** Renew the token when less than this remains (backend tokens live 7 days by default). */
export const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/** How often an authenticated tab checks whether renewal is due. */
export const REFRESH_CHECK_INTERVAL_MS = 30 * 60 * 1000;

/** Cross-tab lock name: only one tab renews, others adopt the new token from storage. */
export const REFRESH_LOCK_NAME = 'abo-ali.auth.refresh';

export function shouldRefresh(expiresAt: string | null, now = Date.now()): boolean {
  if (expiresAt === null) return false;
  const expires = Date.parse(expiresAt);
  if (Number.isNaN(expires)) return false;
  return expires - now < REFRESH_THRESHOLD_MS;
}

/** Runs `task` under a Web Lock when the browser supports it (all evergreen browsers do). */
export async function withRefreshLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = (globalThis.navigator as Navigator | undefined)?.locks;
  if (!locks) return task();
  return locks.request(REFRESH_LOCK_NAME, task);
}
