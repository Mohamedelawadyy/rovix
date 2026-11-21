import type { RouteObject } from 'react-router';
import { NAV_ITEMS } from '@/app/navigation';
import { HomeRedirect } from '@/app/pages/HomeRedirect';
import { NotFoundPage, RouteErrorPage, RouteHydrateFallback } from '@/app/pages/StatusPages';
import { RequirePermission } from '@/features/auth/components/RequirePermission';
import { GuestOnly, RequireAuth } from '@/features/auth/components/RouteGuards';
import { AppLayout } from '@/layouts/app/AppLayout';

/**
 * Child routes of built modules, keyed by NAV_ITEMS key (paths relative to the module path).
 * Every page is lazy-loaded. Modules not listed here render a placeholder.
 */
const MODULE_CHILDREN: Partial<Record<string, RouteObject[]>> = {
  vehicles: [
    {
      index: true,
      lazy: async () => ({
        Component: (await import('@/features/vehicles/pages/VehiclesListPage')).VehiclesListPage,
      }),
    },
    {
      path: 'new',
      element: <RequirePermission permission="vehicles.create" />,
      children: [
        {
          index: true,
          lazy: async () => ({
            Component: (await import('@/features/vehicles/pages/VehicleFormPages'))
              .VehicleCreatePage,
          }),
        },
      ],
    },
    {
      path: 'transfers',
      lazy: async () => ({
        Component: (await import('@/features/vehicles/pages/VehicleTransfersPage'))
          .VehicleTransfersPage,
      }),
    },
    {
      path: ':vehicleId',
      lazy: async () => ({
        Component: (await import('@/features/vehicles/pages/VehicleDetailPage')).VehicleDetailPage,
      }),
    },
    {
      path: ':vehicleId/edit',
      element: <RequirePermission permission="vehicles.update" />,
      children: [
        {
          index: true,
          lazy: async () => ({
            Component: (await import('@/features/vehicles/pages/VehicleFormPages')).VehicleEditPage,
          }),
        },
      ],
    },
  ],
};

/** Module routes are generated from NAV_ITEMS and guarded by the module's view permission. */
const moduleRoutes: RouteObject[] = NAV_ITEMS.map((item) => ({
  path: item.to,
  element: <RequirePermission permission={item.permission} />,
  children: MODULE_CHILDREN[item.key] ?? [
    {
      index: true,
      lazy: async () => {
        const { ModulePlaceholderPage } = await import('@/app/pages/ModulePlaceholderPage');
        return { element: <ModulePlaceholderPage title={item.label} /> };
      },
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
