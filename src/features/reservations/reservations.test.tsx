import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw/http';
import type { AuthUser } from '@/features/auth/types';
import { apiSession } from '@/lib/api';
import { laravel } from '@/test/msw/laravel';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render-app';
import { parseReservationListParams, toSearchParams } from './list-params';
import { isOverdue, isValidReason, type Reservation } from './types';

const API = '*/api/v1';
const session = { token: 't', expiresAt: '2099-01-01T00:00:00Z' };

function makeUser(permissions: string[]): AuthUser {
  return {
    id: 4,
    name: 'Sara Sales',
    email: 's@x.co',
    phone: null,
    is_active: true,
    locale: 'ar',
    last_login_at: null,
    created_at: '',
    roles: ['Sales Employee'],
    permissions,
    branches: [{ id: 1, name: 'مدينة نصر', code: 'NSR' }],
  };
}

const sales = makeUser([
  'vehicles.view',
  'customers.view',
  'reservations.view',
  'reservations.create',
]);
const manager = makeUser(['reservations.view', 'reservations.create', 'reservations.cancel']);

const active: Reservation = {
  id: 5,
  number: 'RSV000005',
  vehicle: { id: 77, stock_number: 'STK000077', vin: null },
  customer: { id: 9, name: 'أحمد علي', customer_code: 'CUS000009' },
  branch_id: 1,
  status: 'active',
  expires_at: '2099-12-01T12:00:00+02:00',
  notes: null,
  sales_contract_id: null,
  reserved_by: 4,
  released_at: null,
  release_reason: null,
  created_at: '2026-11-20T10:00:00+02:00',
};

const vehicle = {
  id: 77,
  stock_number: 'STK000077',
  brand: { id: 1, name: 'Toyota' },
  model: { id: 12, name: 'Yaris' },
  year: 2025,
  vin: null,
  color: 'أحمر',
  status: 'available',
};
const customer = {
  id: 9,
  customer_code: 'CUS000009',
  name: 'أحمد علي',
  phone: '01001234567',
  status: 'active',
};

afterEach(() => {
  localStorage.clear();
  apiSession.setToken(null);
});

describe('reservation helpers', () => {
  it('flags only active reservations past their expiry as overdue', () => {
    const now = new Date('2026-11-22T00:00:00Z').getTime();
    const past = { ...active, expires_at: '2026-11-21T00:00:00Z' };
    expect(isOverdue(past, now)).toBe(true);
    expect(isOverdue({ ...past, status: 'released' }, now)).toBe(false);
    expect(isOverdue({ ...active, expires_at: null }, now)).toBe(false);
    expect(isOverdue(active, now)).toBe(false);
  });

  it('mirrors the release reason rule (3–255 chars)', () => {
    expect(isValidReason(' ab ')).toBe(false);
    expect(isValidReason('abc')).toBe(true);
    expect(isValidReason('x'.repeat(256))).toBe(false);
  });

  it('keeps only allowlisted list params', () => {
    const params = parseReservationListParams(
      new URLSearchParams('status=expired&sort=number&search=RSV&branch_id=2&page=2'),
    );
    expect(params).toEqual({
      page: 2,
      per_page: 15,
      sort: '-created_at',
      search: 'RSV',
      filter: { branch_id: 2 },
    });
    expect(toSearchParams(params).toString()).toBe('search=RSV&branch_id=2&page=2');
  });
});

describe('reservations list', () => {
  it('lists reservations and marks overdue ones', async () => {
    server.use(
      http.get(`${API}/auth/me`, () => laravel.ok(sales)),
      http.get(`${API}/reservations`, () =>
        laravel.paginated([
          active,
          { ...active, id: 6, number: 'RSV000006', expires_at: '2020-01-01T00:00:00Z' },
          { ...active, id: 7, number: 'RSV000007', status: 'released' },
        ]),
      ),
    );
    renderApp({ route: '/reservations', session });

    const overdueRow = (await screen.findByRole('link', { name: 'RSV000006' })).closest('tr');
    expect(within(overdueRow as HTMLElement).getByText('عدّى موعده')).toBeInTheDocument();
    const releasedRow = screen.getByRole('link', { name: 'RSV000007' }).closest('tr');
    expect(within(releasedRow as HTMLElement).getByText('ملغي')).toBeInTheDocument();
    expect(within(releasedRow as HTMLElement).queryByText('عدّى موعده')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /حجز جديد/ })).toBeInTheDocument();
  });
});

describe('create reservation', () => {
  function mockPickers() {
    server.use(
      http.get(`${API}/auth/me`, () => laravel.ok(sales)),
      http.get(`${API}/vehicles`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('filter[status]')).toBe('available');
        return laravel.paginated([vehicle]);
      }),
      http.get(`${API}/vehicles/77`, () => laravel.ok(vehicle)),
      http.get(`${API}/customers`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('filter[status]')).toBe('active');
        return laravel.paginated([customer]);
      }),
      http.get(`${API}/reservations/5`, () => laravel.ok(active)),
    );
  }

  it('reserves a picked vehicle for a picked customer', async () => {
    let body: unknown;
    mockPickers();
    server.use(
      http.post(`${API}/reservations`, async ({ request }) => {
        body = await request.json();
        return laravel.created(active);
      }),
    );
    const { user, router } = renderApp({ route: '/reservations/new', session });

    // Required pickers are checked before any request.
    await user.click(await screen.findByRole('button', { name: 'تأكيد الحجز' }));
    expect(screen.getAllByText('الحقل ده مطلوب.')).toHaveLength(2);

    const vehicles = await screen.findByRole('list', { name: 'العربية' });
    await user.click(within(vehicles).getByRole('button', { name: /Toyota Yaris 2025/ }));
    // Focus moves to the selection's "change" button.
    expect(screen.getByRole('button', { name: 'تغيير: العربية' })).toHaveFocus();
    const customers = await screen.findByRole('list', { name: 'العميل' });
    await user.click(within(customers).getByRole('button', { name: /أحمد علي/ }));
    await user.type(screen.getByLabelText(/ملاحظات/), 'هيدفع المقدم بكرة');
    await user.click(screen.getByRole('button', { name: 'تأكيد الحجز' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/reservations/5');
    });
    expect(body).toEqual({
      vehicle_id: 77,
      customer_id: 9,
      expires_at: null,
      notes: 'هيدفع المقدم بكرة',
    });
    expect(await screen.findByText('تم حجز العربية.')).toBeInTheDocument();
  });

  it('preselects the vehicle from ?vehicle_id and shows 409 business errors', async () => {
    mockPickers();
    server.use(
      http.post(`${API}/reservations`, () =>
        laravel.conflict(
          'vehicle_not_available',
          'لا يمكن حجز السيارة (الحالة الحالية: reserved).',
        ),
      ),
    );
    const { user } = renderApp({ route: '/reservations/new?vehicle_id=77', session });

    // The preselected vehicle replaces the search once loaded.
    await screen.findByRole('button', { name: 'تغيير: العربية' });
    expect(screen.getByText('Toyota Yaris 2025')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'العربية' })).not.toBeInTheDocument();
    const customers = await screen.findByRole('list', { name: 'العميل' });
    await user.click(within(customers).getByRole('button', { name: /أحمد علي/ }));
    await user.click(screen.getByRole('button', { name: 'تأكيد الحجز' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('لا يمكن حجز السيارة');
  });
});

describe('release reservation', () => {
  it('requires a reason and returns the vehicle to stock', async () => {
    let body: unknown;
    let current: Reservation = active;
    server.use(
      http.get(`${API}/auth/me`, () => laravel.ok(manager)),
      http.get(`${API}/reservations/5`, () => laravel.ok(current)),
      http.post(`${API}/reservations/5/release`, async ({ request }) => {
        body = await request.json();
        current = {
          ...active,
          status: 'released',
          released_at: '2026-11-22T10:00:00+02:00',
          release_reason: 'العميل اعتذر',
        };
        return laravel.ok(current);
      }),
    );
    const { user } = renderApp({ route: '/reservations/5', session });

    await user.click(await screen.findByRole('button', { name: 'إلغاء الحجز' }));
    const dialog = screen.getByRole('dialog', { name: 'إلغاء الحجز' });
    await user.click(within(dialog).getByRole('button', { name: 'إلغاء الحجز' }));
    expect(within(dialog).getByLabelText('سبب الإلغاء')).toHaveAccessibleDescription(
      /السبب لازم يكون من 3 لـ 255 حرف/,
    );
    expect(body).toBeUndefined();

    await user.type(within(dialog).getByLabelText('سبب الإلغاء'), 'العميل اعتذر');
    await user.click(within(dialog).getByRole('button', { name: 'إلغاء الحجز' }));

    expect(await screen.findByText('تم إلغاء الحجز، والعربية رجعت متاحة.')).toBeInTheDocument();
    expect(body).toEqual({ reason: 'العميل اعتذر' });
    expect(screen.getByText('ملغي')).toBeInTheDocument();
    expect(screen.getByText('العميل اعتذر')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'إلغاء الحجز' })).not.toBeInTheDocument();
  });

  it('is not offered without reservations.cancel', async () => {
    server.use(
      http.get(`${API}/auth/me`, () => laravel.ok(sales)),
      http.get(`${API}/reservations/5`, () => laravel.ok(active)),
    );
    renderApp({ route: '/reservations/5', session });
    expect(await screen.findByRole('heading', { level: 1, name: 'RSV000005' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'إلغاء الحجز' })).not.toBeInTheDocument();
  });
});
