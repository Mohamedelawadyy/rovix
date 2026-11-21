import { env } from '@/app/config/env';

/**
 * Temporary application shell. Routing, layouts and providers arrive in FE-006/FE-007.
 */
export function App() {
  return (
    <main>
      <h1>{env.appName}</h1>
    </main>
  );
}
