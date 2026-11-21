import type { RouteObject } from 'react-router';
import { NAV_ITEMS } from '@/app/navigation';
import { HomeRedirect } from '@/app/pages/HomeRedirect';
import { NotFoundPage, RouteErrorPage, RouteHydrateFallback } from '@/app/pages/StatusPages';
import { RequirePermission } from '@/features/auth/components/RequirePermission';
import { GuestOnly, RequireAuth } from '@/features/auth/components/RouteGuards';
import { AppLayout } from '@/layouts/app/AppLayout';

/**
 * Module routes are generated from NAV_ITEMS, guarded by the module permission and lazily
 * loaded (one chunk per module). Until a module is built it renders a placeholder; FE-008+
 * replace the lazy import with the real feature page.
 */
/** Built module list pages, keyed by NAV_ITEMS key. Others show the placeholder. */
const MODULE_PAGES: Partial<Record<string, RouteObject['lazy']>> = {
  vehicles: async () => ({
    Component: (await import('@/features/vehicles/pages/VehiclesListPage')).VehiclesListPage,
  }),
};

const moduleRoutes: RouteObject[] = NAV_ITEMS.map((item) => ({
  path: item.to,
  element: <RequirePermission permission={item.permission} />,
  children: [
    {
      index: true,
      lazy:
        MODULE_PAGES[item.key] ??
        (async () => {
          const { ModulePlaceholderPage } = await import('@/app/pages/ModulePlaceholderPage');
          return { element: <ModulePlaceholderPage title={item.label} /> };
        }),
    },
  ],
}));

/** Shared by the browser router and tests (memory router). */
export const routes: RouteObject[] = [
  {
    errorElement: <RouteErrorPage />,
    hydrateFallbackElement: <RouteHydrateFallback />,
    children: [
      {
        element: <GuestOnly />,
        children: [
          {
            path: '/login',
            lazy: async () => ({
              Component: (await import('@/features/auth/pages/LoginPage')).LoginPage,
            }),
          },
          {
            path: '/forgot-password',
            lazy: async () => ({
              Component: (await import('@/features/auth/pages/ForgotPasswordPage'))
                .ForgotPasswordPage,
            }),
          },
        ],
      },
      // Reachable signed in or out: the emailed link must always work.
      {
        path: '/reset-password',
        lazy: async () => ({
          Component: (await import('@/features/auth/pages/ResetPasswordPage')).ResetPasswordPage,
        }),
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              { index: true, element: <HomeRedirect /> },
              ...moduleRoutes,
              // Signed-in users get a 404 inside the layout; guests are sent to login first.
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
];
