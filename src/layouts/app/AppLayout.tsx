import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigation } from 'react-router';
import { Icon } from '@/components/ui/Icon';
import { visibleNavItems } from '@/app/navigation';
import { useAuth } from '@/features/auth/auth-context';
import { ar } from '@/locales/ar';
import { SidebarNav } from './SidebarNav';
import { UserMenu } from './UserMenu';

/** Authenticated shell: sidebar (drawer below lg), header, and the routed page. */
export function AppLayout() {
  const { user } = useAuth();
  const items = visibleNavItems(user);
  const navigation = useNavigation();
  const location = useLocation();
  // The drawer belongs to the page it was opened on, so any navigation closes it.
  const [drawerOpenedAt, setDrawerOpenedAt] = useState<string | null>(null);
  const drawerOpen = drawerOpenedAt === location.pathname;
  const setDrawerOpen = (open: boolean) => {
    setDrawerOpenedAt(open ? location.pathname : null);
  };
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Escape closes the drawer; focus moves into it and back to the toggle.
  useEffect(() => {
    if (!drawerOpen) return;
    closeButtonRef.current?.focus();
    const menuButton = menuButtonRef.current;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDrawerOpenedAt(null);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      menuButton?.focus();
    };
  }, [drawerOpen]);

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2"
      >
        {ar.nav.skipToContent}
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 hidden w-64 lg:block">
        <SidebarNav items={items} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className="absolute inset-0 bg-sidebar/60"
            onClick={() => {
              setDrawerOpen(false);
            }}
          />
          <aside
            id="mobile-nav"
            className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col shadow-lg"
          >
            <button
              ref={closeButtonRef}
              type="button"
              aria-label={ar.nav.close}
              className="absolute end-2 top-2 z-10 rounded-md p-2 text-fg-on-sidebar hover:text-fg-inverse"
              onClick={() => {
                setDrawerOpen(false);
              }}
            >
              <Icon name="close" />
            </button>
            <SidebarNav
              items={items}
              onNavigate={() => {
                setDrawerOpen(false);
              }}
            />
          </aside>
        </div>
      ) : null}

      <div className="lg:ps-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-surface px-4 sm:px-6">
          <button
            ref={menuButtonRef}
            type="button"
            aria-label={ar.nav.open}
            aria-expanded={drawerOpen}
            aria-controls="mobile-nav"
            className="rounded-md p-2 text-fg-secondary hover:bg-surface-muted lg:hidden"
            onClick={() => {
              setDrawerOpen(true);
            }}
          >
            <Icon name="menu" />
          </button>
          <div className="flex-1" />
          <UserMenu />
        </header>

        {/* Lazy pages are loading */}
        {navigation.state === 'loading' ? (
          <div
            role="progressbar"
            aria-label={ar.common.loading}
            className="h-0.5 w-full animate-pulse bg-accent"
          />
        ) : null}

        <main id="main-content" tabIndex={-1} className="p-4 outline-none sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
