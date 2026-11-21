import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '@/app/providers/AppProviders';
import { createQueryClient } from '@/app/query-client';
import { routes } from '@/app/router/routes';
import { TOKEN_STORAGE_KEY } from '@/features/auth/token-storage';
import type { StoredSession } from '@/features/auth/types';

interface RenderAppOptions {
  /** Initial URL, e.g. `/login?redirect=%2Fvehicles`. */
  route?: string;
  /** Pre-existing persisted session (simulates a returning user). */
  session?: StoredSession;
}

/** Renders the real route tree and providers, as the browser app does. */
export function renderApp({ route = '/', session }: RenderAppOptions = {}) {
  if (session) localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(session));

  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false, staleTime: 0 } });
  const router = createMemoryRouter(routes, { initialEntries: [route] });

  const utils = render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );

  return { ...utils, router, queryClient, user: userEvent.setup() };
}
