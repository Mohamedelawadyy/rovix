import type { AuthUser } from './types';

/** Mirrors the backend `Gate::before`: Super Admin passes every check. */
export const SUPER_ADMIN_ROLE = 'Super Admin';

export function isSuperAdmin(user: AuthUser | null | undefined): boolean {
  return user?.roles?.includes(SUPER_ADMIN_ROLE) ?? false;
}

/**
 * UI-level permission check (`vehicles.view-cost`, ...). Only for showing/hiding UI:
 * the backend remains the security boundary and every 403 must still be handled.
 */
export function can(user: AuthUser | null | undefined, permission: string): boolean {
  if (!user) return false;
  return isSuperAdmin(user) || (user.permissions?.includes(permission) ?? false);
}

export function canAny(user: AuthUser | null | undefined, permissions: readonly string[]): boolean {
  return permissions.some((permission) => can(user, permission));
}

/** Users with `branches.access-all` (or Super Admin) are not limited to their own branches. */
export function canAccessAllBranches(user: AuthUser | null | undefined): boolean {
  return can(user, 'branches.access-all');
}

/**
 * Mirrors the backend BranchGuard: all-branch users pass; others need the branch in /auth/me.
 * Used to decide which transfer actions (receive = destination, cancel = source) to offer.
 */
export function canAccessBranch(
  user: AuthUser | null | undefined,
  branchId: number | null | undefined,
): boolean {
  if (!user || branchId === null || branchId === undefined) return false;
  if (canAccessAllBranches(user)) return true;
  return (user.branches ?? []).some((branch) => branch.id === branchId);
}
