import type { AuthUser } from '@/features/auth/types';
import { can } from '@/features/auth/permissions';
import { ar } from '@/locales/ar';
import type { IconName } from '@/components/ui/Icon';

export interface NavItem {
  key: string;
  label: string;
  /** Absolute path of the module's list page. */
  to: string;
  /** Backend permission required to see and open the module (BACKEND_API_REFERENCE.md §4). */
  permission: string;
  icon: IconName;
}

/**
 * First product scope (FE-007 decision): the showroom sales flow.
 * Add modules here when they are built; routes and the sidebar are generated from this list.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    key: 'dashboard',
    label: ar.nav.dashboard,
    to: '/dashboard',
    permission: 'dashboard.view',
    icon: 'dashboard',
  },
  {
    key: 'vehicles',
    label: ar.nav.vehicles,
    to: '/vehicles',
    permission: 'vehicles.view',
    icon: 'car',
  },
  {
    key: 'customers',
    label: ar.nav.customers,
    to: '/customers',
    permission: 'customers.view',
    icon: 'users',
  },
  {
    key: 'sales-contracts',
    label: ar.nav.salesContracts,
    to: '/sales-contracts',
    permission: 'sales-contracts.view',
    icon: 'contract',
  },
  {
    key: 'reservations',
    label: ar.nav.reservations,
    to: '/reservations',
    permission: 'reservations.view',
    icon: 'bookmark',
  },
];

/** Modules the user may open. UX only: the backend still authorizes every request. */
export function visibleNavItems(user: AuthUser | null | undefined): NavItem[] {
  return NAV_ITEMS.filter((item) => can(user, item.permission));
}
