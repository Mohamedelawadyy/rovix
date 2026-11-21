import { useState } from 'react';
import { BrandLogo } from '@/components/shared/BrandLogo';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/auth-context';
import { ar, interpolate } from '@/locales/ar';

/** Placeholder landing page until the app layout and dashboard arrive (FE-007+). */
export function HomePage() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center gap-6 p-6 text-center">
      <BrandLogo height={56} />
      <h1 className="text-2xl font-semibold text-fg">
        {interpolate(ar.auth.home.welcome, { name: user?.name ?? '' })}
      </h1>
      {user?.roles?.length ? <p className="text-fg-muted">{user.roles.join('، ')}</p> : null}
      <Button
        variant="secondary"
        loading={loggingOut}
        loadingLabel={ar.auth.home.loggingOut}
        onClick={() => {
          setLoggingOut(true);
          void logout();
        }}
      >
        {ar.auth.home.logout}
      </Button>
    </main>
  );
}
