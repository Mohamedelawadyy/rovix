import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { useAuth } from '@/features/auth/auth-context';
import { canAccessAllBranches } from '@/features/auth/permissions';
import { ar } from '@/locales/ar';

/** Signed-in user summary (name, role, branch scope) and logout. */
export function UserMenu() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  if (!user) return null;

  const branchLabel = canAccessAllBranches(user)
    ? ar.layout.allBranches
    : (user.branches ?? []).map((branch) => branch.name).join('، ');
  const details = [user.roles?.join('، '), branchLabel].filter(Boolean).join(' · ');

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-end sm:block">
        <p className="text-sm font-medium text-fg">{user.name}</p>
        {details ? <p className="text-xs text-fg-muted">{details}</p> : null}
      </div>
      <Button
        variant="ghost"
        loading={loggingOut}
        loadingLabel={ar.auth.home.loggingOut}
        onClick={() => {
          setLoggingOut(true);
          void logout();
        }}
      >
        <Icon name="logout" size={18} />
        <span>{ar.auth.home.logout}</span>
      </Button>
    </div>
  );
}
