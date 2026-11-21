import { Outlet } from 'react-router';
import { ForbiddenPage } from '@/app/pages/StatusPages';
import { useAuth } from '../auth-context';

/**
 * Shows 403 instead of the page when the user lacks the module permission.
 * UX only: the API returns 403 for the same requests regardless of the UI.
 */
export function RequirePermission({ permission }: { permission: string }) {
  const { can } = useAuth();
  return can(permission) ? <Outlet /> : <ForbiddenPage />;
}
