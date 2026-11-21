import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw/http';
import type { AuthUser } from '@/features/auth/types';
import { apiSession } from '@/lib/api';
import { laravel } from '@/test/msw/laravel';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render-app';
import type { Vehicle } from './types';

const API = '*/api/v1';
const session = { token: 't', expiresAt: '2099-01-01T00:00:00Z' };

function makeUser(permissions: string[], overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 3,
    name: 'Mona Manager',
    email: 'm@x.co',
    phone: null,
    is_active: true,
    locale: 'ar',
    last_login_at: null,
    created_at: '',
    roles: ['Branch Manager'],
    permissions,
    branches: [{ id: 1, name: 'مدينة نصر', code: 'NSR' }],
    ...overrides,
  };
}

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 1,
    stock_number: 'STK000101',
    brand: { id: 1, name: 'Toyota' },
    model: { id: 11, name: 'Corolla' },
    year: 2024,
    vin: 'JTDBR32E720123456',
    engine_number: null,
    color: 'أبيض',
    mileage: 12500,
    transmission: 'automatic',
    fuel_type: 'petrol',
    vehicle_type: 'sedan',
    selling_price: '1250000.00',
    purchase_date: '2026-10-01',
    branch: { id: 1, name: 'مدينة نصر' },
    description: null,
    specifications: null,
    status: 'available',
    created_at: '2026-10-01T10:00:00+02:00',
    updated_at: '2026-10-01T10:00:00+02:00',
    ...overrides,
  };
}

/** Registers handlers and records every /vehicles request URL. */
function mockInventory({
  user,
  vehicles = [makeVehicle()],
  total = vehicles.length,
}: {
  user: AuthUser;
  vehicles?: Vehicle[];
  total?: number;
}) {
  const requests: URL[] = [];
  server.use(
    http.get(`${API}/auth/me`, () => laravel.ok(user)),
    http.get(`${API}/vehicles`, ({ request }) => {
      const url = new URL(request.url);
      requests.push(url);
      const page = Number(url.searchParams.get('page') ?? '1');
      const perPage = Number(url.searchParams.get('per_page') ?? '15');
      return laravel.paginated(vehicles, page, perPage, total);
    }),
    http.get(`${API}/vehicle-brands`, () =>
      laravel.paginated([
        { id: 1, name: 'Toyota', country: 'Japan', is_active: true },
        { id: 2, name: 'Hyundai', country: 'Korea', is_active: true },
      ]),
    ),
    http.get(`${API}/vehicle-models`, ({ request }) => {
      const brandId = new URL(request.url).searchParams.get('filter[brand_id]');
      return laravel.paginated(
        brandId === '1'
          ? [
              { id: 11, brand_id: 1, name: 'Corolla', is_active: true },
              { id: 12, brand_id: 1, name: 'Yaris', is_active: true },
            ]
          : [{ id: 21, brand_id: 2, name: 'Tucson', is_active: true }],
      );
    }),
  );
  return { requests, last: () => requests.at(-1) };
}

const viewer = makeUser(['vehicles.view']);

afterEach(() => {
  localStorage.clear();
  apiSession.setToken(null);
});

describe('vehicles list', () => {
  it('loads the first page with default params and renders vehicles', async () => {
    const { last } = mockInventory({ user: viewer, total: 1 });
    renderApp({ route: '/vehicles', session });

    const table = await screen.findByRole('table', { name: 'المخزون' });
    const row = within(table).getAllByRole('row')[1] as HTMLElement;
    expect(within(row).getByText('STK000101')).toBeInTheDocument();
    expect(within(row).getByText('Toyota Corolla')).toBeInTheDocument();
    expect(within(row).getByText('سيدان · بنزين · أوتوماتيك')).toBeInTheDocument();
    expect(within(row).getByText('12,500 كم')).toBeInTheDocument();
    expect(within(row).getByText('1,250,000.00')).toBeInTheDocument();
    expect(within(row).getByText('متاحة')).toBeInTheDocument();
    expect(screen.getByText('1 عربية')).toBeInTheDocument();

    const url = last();
    expect(url?.searchParams.get('page')).toBe('1');
    expect(url?.searchParams.get('per_page')).toBe('15');
    expect(url?.searchParams.get('sort')).toBe('-created_at');
    expect([...(url?.searchParams.keys() ?? [])].some((k) => k.startsWith('filter'))).toBe(false);
  });

  it('shows cost only to users with vehicles.view-cost', async () => {
    mockInventory({ user: viewer });
    const { unmount } = renderApp({ route: '/vehicles', session });
    await screen.findByRole('table');
    expect(screen.queryByRole('columnheader', { name: 'إجمالي التكلفة' })).not.toBeInTheDocument();
    unmount();
    localStorage.clear();

    mockInventory({
      user: makeUser(['vehicles.view', 'vehicles.view-cost']),
      vehicles: [makeVehicle({ total_cost: '980000.50' })],
    });
    renderApp({ route: '/vehicles', session });
    expect(await screen.findByRole('columnheader', { name: 'إجمالي التكلفة' })).toBeInTheDocument();
    expect(screen.getByText('980,000.50')).toBeInTheDocument();
  });

  it('filters by status through the URL and resets to page 1', async () => {
    const { last } = mockInventory({ user: viewer, total: 40 });
    const { user, router } = renderApp({ route: '/vehicles?page=2', session });
    await screen.findByRole('table');

    await user.selectOptions(screen.getByLabelText('الحالة'), 'متاحة');

    await waitFor(() => {
      expect(last()?.searchParams.get('filter[status]')).toBe('available');
    });
    expect(last()?.searchParams.get('page')).toBe('1');
    expect(router.state.location.search).toBe('?status=available');
  });

  it('loads models for the chosen brand and clears the model when the brand changes', async () => {
    const { last } = mockInventory({ user: viewer });
    const { user, router } = renderApp({ route: '/vehicles', session });
    await screen.findByRole('table');

    const modelSelect = screen.getByLabelText('الموديل');
    expect(modelSelect).toBeDisabled();

    await user.selectOptions(await screen.findByLabelText('الماركة'), 'Toyota');
    await user.selectOptions(modelSelect, await screen.findByRole('option', { name: 'Yaris' }));
    await waitFor(() => {
      expect(last()?.searchParams.get('filter[model_id]')).toBe('12');
    });

    await user.selectOptions(screen.getByLabelText('الماركة'), 'Hyundai');
    await waitFor(() => {
      expect(router.state.location.search).toBe('?brand_id=2');
    });
    expect(last()?.searchParams.get('filter[model_id]')).toBeNull();
  });

  it('debounces search and sends it to the backend', async () => {
    const { requests, last } = mockInventory({ user: viewer });
    const { user } = renderApp({ route: '/vehicles', session });
    await screen.findByRole('table');
    const before = requests.length;

    await user.type(screen.getByRole('searchbox', { name: 'بحث' }), 'corolla');

    await waitFor(() => {
      expect(last()?.searchParams.get('search')).toBe('corolla');
    });
    // One request for the whole word, not one per keystroke.
    expect(requests.length - before).toBe(1);
  });

  it('pages through results', async () => {
    const { last } = mockInventory({ user: viewer, total: 40 });
    const { user } = renderApp({ route: '/vehicles', session });
    await screen.findByText('صفحة 1 من 3');

    await user.click(screen.getByRole('button', { name: 'التالي' }));

    expect(await screen.findByText('صفحة 2 من 3')).toBeInTheDocument();
    expect(last()?.searchParams.get('page')).toBe('2');
    expect(screen.getByText('عرض 16–30 من 40')).toBeInTheDocument();
  });

  it('restores list state from a shared URL', async () => {
    const { last } = mockInventory({ user: viewer, total: 100 });
    renderApp({ route: '/vehicles?status=sold&sort=-selling_price&per_page=50&page=2', session });
    await screen.findByRole('table');

    const url = last();
    expect(url?.searchParams.get('filter[status]')).toBe('sold');
    expect(url?.searchParams.get('sort')).toBe('-selling_price');
    expect(url?.searchParams.get('per_page')).toBe('50');
    expect(url?.searchParams.get('page')).toBe('2');
    expect(screen.getByLabelText('الحالة')).toHaveValue('sold');
    expect(screen.getByLabelText('الترتيب')).toHaveValue('-selling_price');
  });

  it('explains an empty result and clears the filters', async () => {
    mockInventory({ user: viewer, vehicles: [], total: 0 });
    const { user, router } = renderApp({ route: '/vehicles?status=sold', session });

    expect(await screen.findByRole('heading', { name: 'مفيش عربيات مطابقة' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'مسح الفلاتر' }));

    expect(await screen.findByRole('heading', { name: 'المخزون فاضي' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('');
  });

  it('shows an error with retry when the list fails', async () => {
    mockInventory({ user: viewer });
    let calls = 0;
    server.use(
      http.get(`${API}/vehicles`, () => {
        calls += 1;
        return calls === 1
          ? laravel.error(403, 'ليس لديك صلاحية.')
          : laravel.paginated([makeVehicle()]);
      }),
    );
    const { user } = renderApp({ route: '/vehicles', session });

    expect(await screen.findByRole('alert')).toHaveTextContent('ليس لديك صلاحية.');
    await user.click(screen.getByRole('button', { name: 'إعادة المحاولة' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('offers a branch filter from /auth/me for multi-branch users without branches.view', async () => {
    mockInventory({
      user: makeUser(['vehicles.view'], {
        branches: [
          { id: 1, name: 'مدينة نصر', code: 'NSR' },
          { id: 2, name: 'الشيخ زايد', code: 'ZYD' },
        ],
      }),
    });
    renderApp({ route: '/vehicles', session });
    await screen.findByRole('table');

    // No /branches handler: calling it would fail the test.
    const branch = screen.getByLabelText('الفرع');
    expect(within(branch).getByRole('option', { name: 'الشيخ زايد' })).toBeInTheDocument();
  });

  it('hides the branch filter for single-branch users', async () => {
    mockInventory({ user: viewer });
    renderApp({ route: '/vehicles', session });
    await screen.findByRole('table');

    expect(screen.queryByLabelText('الفرع')).not.toBeInTheDocument();
  });

  it('lists branches from the API for users with branches.view', async () => {
    mockInventory({ user: makeUser(['vehicles.view', 'branches.view']) });
    server.use(
      http.get(`${API}/branches`, () =>
        laravel.paginated([
          { id: 1, name: 'مدينة نصر' },
          { id: 2, name: 'الشيخ زايد' },
          { id: 3, name: 'المعادي' },
        ]),
      ),
    );
    renderApp({ route: '/vehicles', session });

    const branch = await screen.findByLabelText('الفرع');
    expect(within(branch).getByRole('option', { name: 'المعادي' })).toBeInTheDocument();
  });
});
