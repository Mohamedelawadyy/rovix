import { Link, useRouteError } from 'react-router';
import { Button } from '@/components/ui/Button';
import { StatusPage } from '@/components/shared/StatusPage';
import { ar } from '@/locales/ar';

const linkClass =
  'inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-hover';

export function ForbiddenPage() {
  return (
    <StatusPage
      code="403"
      title={ar.pages.forbiddenTitle}
      body={ar.pages.forbiddenBody}
      actions={
        <Link to="/" className={linkClass}>
          {ar.common.backHome}
        </Link>
      }
    />
  );
}

export function NotFoundPage() {
  return (
    <StatusPage
      code="404"
      title={ar.pages.notFoundTitle}
      body={ar.pages.notFoundBody}
      actions={
        <Link to="/" className={linkClass}>
          {ar.common.backHome}
        </Link>
      }
    />
  );
}

/**
 * Route `errorElement`: rendering errors and failed lazy chunks (e.g. after a deploy).
 * Rendered outside the layout, so it stands alone.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  if (import.meta.env.DEV) console.error(error);

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <StatusPage
        title={ar.pages.errorTitle}
        body={ar.pages.errorBody}
        actions={
          <Button
            variant="primary"
            onClick={() => {
              window.location.reload();
            }}
          >
            {ar.common.reload}
          </Button>
        }
      />
    </main>
  );
}

export function RouteHydrateFallback() {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <p role="status" className="text-fg-muted">
        {ar.common.loading}
      </p>
    </main>
  );
}
