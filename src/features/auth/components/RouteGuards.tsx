import { Navigate, Outlet, useLocation } from 'react-router';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/api/error-message';
import { ar } from '@/locales/ar';
import { useAuth } from '../auth-context';

function FullPageStatus({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">{children}</div>
    </main>
  );
}

/** Session restore in progress, or verification failed (backend unreachable). */
function SessionPending() {
  const { status, error, retry, logout } = useAuth();

  if (status === 'error') {
    return (
      <FullPageStatus>
        <Alert tone="danger">
          {ar.errors.sessionUnavailable} {getErrorMessage(error)}
        </Alert>
        <div className="flex gap-2">
          <Button variant="primary" onClick={retry}>
            {ar.common.retry}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              void logout();
            }}
          >
            {ar.auth.home.logout}
          </Button>
        </div>
      </FullPageStatus>
    );
  }

  return (
    <FullPageStatus>
      <p role="status" className="text-fg-muted">
        {ar.common.loading}
      </p>
    </FullPageStatus>
  );
}

/**
 * Routes that need a signed-in user. UX only: the backend enforces authentication and
 * permissions on every request.
 */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'unauthenticated') {
    const target = `${location.pathname}${location.search}`;
    const redirect = target === '/' ? '' : `?redirect=${encodeURIComponent(target)}`;
    return <Navigate to={`/login${redirect}`} replace />;
  }
  if (status !== 'authenticated') return <SessionPending />;
  return <Outlet />;
}

/** Login / password pages: signed-in users are sent into the app. */
export function GuestOnly() {
  const { status } = useAuth();

  if (status === 'authenticated') return <Navigate to="/" replace />;
  if (status === 'loading' || status === 'error') return <SessionPending />;
  return <Outlet />;
}
