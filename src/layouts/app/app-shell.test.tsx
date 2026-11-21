import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw/http';
import { NAV_ITEMS, visibleNavItems } from '@/app/navigation';
import type { AuthUser } from '@/features/auth/types';
import { apiSession } from '@/lib/api';
import { laravel } from '@/test/msw/laravel';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render-app';

const API = '*/api/v1';
const session = { token: 't', expiresAt: '2099-01-01T00:00:00Z' };

function makeUser(overrides: Partial<AuthUser>): AuthUser {
  return {
    id: 7,
    name: 'Sara Sales',
    email: 'sales.cairo@nilemotors.test',
    phone: null,
    is_active: true,
    locale: 'ar',
    last_login_at: null,
    created_at: '',
    roles: ['Sales Employee'],
    permissions: [],
    branches: [{ id: 1, name: 'مدينة نصر', code: 'NSR' }],
    ...overrides,
  };
}

/** Seeded role permissions relevant to the first scope (BACKEND_API_REFERENCE.md §4). */
const salesEmployee = makeUser({
  permissions: [
    'dashboard.view',
    'vehicles.view',
    'customers.view',
    'customers.create',
    'reservations.view',
    'sales-contracts.view',
  ],
});
const treasuryEmployee = makeUser({
  name: 'Tamer Treasury',
  roles: ['Treasury Employee'],
  permissions: ['dashboard.view', 'customers.view', 'sales-contracts.view', 'treasury.view'],
});
const hrEmployee = makeUser({
  name: 'Hoda HR',
  roles: ['HR Employee'],
  permissions: ['employees.view', 'attendance.view'],
});

function signInAs(user: AuthUser) {
  server.use(http.get(`${API}/auth/me`, () => laravel.ok(user)));
}

function sidebarLinks() {
  const nav = screen.getAllByRole('navigation', { name: 'القائمة الرئيسية' })[0];
  if (!nav) throw new Error('Main navigation not rendered');
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent);
}

afterEach(() => {
  localStorage.clear();
  apiSession.setToken(null);
});

describe('navigation config', () => {
  it('only lists modules the user can view', () => {
    expect(visibleNavItems(salesEmployee).map((item) => item.key)).toEqual([
      'dashboard',
      'vehicles',
      'customers',
      'sales-contracts',
      'reservations',
    ]);
    expect(visibleNavItems(treasuryEmployee).map((item) => item.key)).toEqual([
      'dashboard',
      'customers',
      'sales-contracts',
    ]);
    expect(visibleNavItems(hrEmployee)).toEqual([]);
    expect(visibleNavItems(makeUser({ roles: ['Super Admin'] }))).toHaveLength(NAV_ITEMS.length);
  });

  it('gives every module a unique key and path', () => {
    expect(new Set(NAV_ITEMS.map((item) => item.key)).size).toBe(NAV_ITEMS.length);
    expect(new Set(NAV_ITEMS.map((item) => item.to)).size).toBe(NAV_ITEMS.length);
  });
});

describe('app shell', () => {
  it('opens the first allowed module and shows a permission-filtered sidebar', async () => {
    signInAs(treasuryEmployee);
    const { router } = renderApp({ route: '/', session });

    expect(await screen.findByRole('heading', { name: 'لوحة التحكم' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/dashboard');
    expect(sidebarLinks()).toEqual(['لوحة التحكم', 'العملاء', 'عقود البيع']);
    await waitFor(() => {
      expect(document.title).toBe('لوحة التحكم | Test CDMS');
    });
  });

  it('shows the user, role and branch scope in the header', async () => {
    signInAs(salesEmployee);
    renderApp({ route: '/', session });

    expect(await screen.findByText('Sara Sales')).toBeInTheDocument();
    expect(screen.getByText('Sales Employee · مدينة نصر')).toBeInTheDocument();
  });

  it('marks the current module as active', async () => {
    signInAs(salesEmployee);
    renderApp({ route: '/customers', session });

    await screen.findByRole('heading', { name: 'العملاء' });
    const nav = screen.getAllByRole('navigation', { name: 'القائمة الرئيسية' })[0];
    expect(within(nav as HTMLElement).getByRole('link', { name: 'العملاء' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('navigates between modules from the sidebar', async () => {
    signInAs(salesEmployee);
    const { user, router } = renderApp({ route: '/dashboard', session });

    await screen.findByRole('heading', { name: 'لوحة التحكم' });
    const nav = screen.getAllByRole('navigation', { name: 'القائمة الرئيسية' })[0] as HTMLElement;
    await user.click(within(nav).getByRole('link', { name: 'الحجوزات' }));

    expect(await screen.findByRole('heading', { name: 'الحجوزات' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/reservations');
  });

  it('shows 403 when opening a module without its permission', async () => {
    signInAs(treasuryEmployee);
    renderApp({ route: '/vehicles', session });

    expect(await screen.findByRole('heading', { name: 'غير مسموح' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'المخزون' })).not.toBeInTheDocument();
  });

  it('shows 404 inside the layout for unknown paths', async () => {
    signInAs(salesEmployee);
    renderApp({ route: '/no-such-page', session });

    expect(await screen.findByRole('heading', { name: 'الصفحة غير موجودة' })).toBeInTheDocument();
    expect(screen.getAllByRole('navigation', { name: 'القائمة الرئيسية' }).length).toBeGreaterThan(
      0,
    );
  });

  it('sends guests on unknown or protected paths to login with the target kept', async () => {
    const { router } = renderApp({ route: '/customers?page=3' });

    await screen.findByRole('heading', { name: 'تسجيل الدخول' });
    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toBe(
      `?redirect=${encodeURIComponent('/customers?page=3')}`,
    );
  });

  it('welcomes users whose role has no module in the current scope', async () => {
    signInAs(hrEmployee);
    renderApp({ route: '/', session });

    expect(await screen.findByRole('heading', { name: 'أهلًا، Hoda HR' })).toBeInTheDocument();
    expect(screen.getByText(/مفيش أقسام متاحة لحسابك/)).toBeInTheDocument();
  });

  it('opens and closes the mobile navigation drawer', async () => {
    signInAs(salesEmployee);
    const { user } = renderApp({ route: '/dashboard', session });
    await screen.findByRole('heading', { name: 'لوحة التحكم' });

    const toggle = screen.getByRole('button', { name: 'فتح القائمة' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: 'إغلاق القائمة' })).toHaveFocus();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });
    expect(toggle).toHaveFocus();
  });

  it('closes the drawer after choosing a module', async () => {
    signInAs(salesEmployee);
    const { user } = renderApp({ route: '/dashboard', session });
    await screen.findByRole('heading', { name: 'لوحة التحكم' });

    await user.click(screen.getByRole('button', { name: 'فتح القائمة' }));
    const drawer = document.getElementById('mobile-nav') as HTMLElement;
    await user.click(within(drawer).getByRole('link', { name: 'العملاء' }));

    expect(await screen.findByRole('heading', { name: 'العملاء' })).toBeInTheDocument();
    expect(document.getElementById('mobile-nav')).toBeNull();
  });

  it('provides a skip link to the main content', async () => {
    signInAs(salesEmployee);
    renderApp({ route: '/dashboard', session });
    await screen.findByRole('heading', { name: 'لوحة التحكم' });

    expect(screen.getByRole('link', { name: 'تخطي إلى المحتوى' })).toHaveAttribute(
      'href',
      '#main-content',
    );
    expect(document.getElementById('main-content')).toBeInTheDocument();
  });
});
