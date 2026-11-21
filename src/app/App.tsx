import { env } from '@/app/config/env';
import { BrandLogo } from '@/components/shared/BrandLogo';

/**
 * Temporary application shell. Routing, layouts and providers arrive in FE-006/FE-007.
 */
export function App() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-6 p-6 text-center">
      <BrandLogo height={56} />
      <h1 className="text-2xl font-semibold text-fg">{env.appName}</h1>
      <p className="text-fg-muted">نظام إدارة معارض السيارات</p>
    </main>
  );
}
