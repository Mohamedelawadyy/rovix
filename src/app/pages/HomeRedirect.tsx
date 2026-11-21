import { Navigate } from 'react-router';
import { visibleNavItems } from '@/app/navigation';
import { StatusPage } from '@/components/shared/StatusPage';
import { useAuth } from '@/features/auth/auth-context';
import { ar, interpolate } from '@/locales/ar';

/** `/` opens the first module the user can access, or explains that none is available yet. */
export function HomeRedirect() {
  const { user } = useAuth();
  const first = visibleNavItems(user)[0];

  if (first) return <Navigate to={first.to} replace />;

  return (
    <StatusPage
      title={interpolate(ar.layout.welcomeTitle, { name: user?.name ?? '' })}
      body={ar.layout.noModules}
    />
  );
}
