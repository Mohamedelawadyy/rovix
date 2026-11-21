import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw/http';
import type { AuthUser } from '@/features/auth/types';
import { apiSession } from '@/lib/api';
import { laravel } from '@/test/msw/laravel';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render-app';
import type { Vehicle, VehicleHistory } from './types';

const API = '*/api/v1';
const session = { token: 't', expiresAt: '2099-01-01T00:00:00Z' };

function makeUser(permissions: string[]): AuthUser {
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
  };
}

const vehicle: Vehicle = {
  id: 42,
  stock_number: 'STK000042',
  brand: { id: 1, name: 'Toyota' },
  model: { id: 11, name: 'Corolla' },
  year: 2024,
  vin: 'JTDBR32E720123456',
  engine_number: '2ZR-123456',
  color: 'أبيض',
  mileage: 12500,
  transmission: 'cvt',
  fuel_type: 'hybrid',
  vehicle_type: 'sedan',
  selling_price: '1250000.00',
  purchase_date: '2026-10-01',
  supplier: { id: 5, name: 'المتحدة للسيارات' },
  branch: { id: 1, name: 'مدينة نصر' },
  description: 'فبريكا بالكامل',
  specifications: { 'فتحة سقف': 'نعم', 'عدد الوسائد الهوائية': '7' },
  status: 'reserved',
  images: [
    { id: 1, url: 'http://localhost:8000/storage/vehicles/42/side.jpg', is_primary: false },
    { id: 2, url: 'http://localhost:8000/storage/vehicles/42/front.jpg', is_primary: true },
  ],
  created_at: '2026-10-01T10:00:00+02:00',
  updated_at: '2026-10-01T10:00:00+02:00',
};

const costView = {
  ...vehicle,
  purchase_price: '1000000.00',
  additional_costs: '15000.50',
  total_cost: '1015000.50',
};

const history: VehicleHistory = {
  status_history: [
    {
      from_status: 'available',
      to_status: 'reserved',
      reason: null,
      source: { type: 'vehicle_reservation', id: 9 },
      changed_by: { id: 7, name: 'Sara Sales' },
      created_at: '2026-11-20T09:30:00+02:00',
    },
    {
      from_status: null,
      to_status: 'available',
      reason: 'تسجيل من أمر شراء',
      source: { type: 'purchase_order', id: 3 },
      changed_by: { id: 3, name: 'Mona Manager' },
      created_at: '2026-10-01T10:00:00+02:00',
    },
  ],
  movements: [
    {
      id: 4,
      reference: 'TRF-2026-000004',
      from_branch: { id: 2, name: 'الشيخ زايد' },
      to_branch: { id: 1, name: 'مدينة نصر' },
      status: 'completed',
      notes: null,
      initiated_by: 3,
      initiated_at: '2026-10-05T11:00:00+02:00',
      completed_by: 3,
      completed_at: '2026-10-06T12:00:00+02:00',
    },
  ],
  costs: [
    {
      id: 8,
      cost_type: 'transportation',
      amount: '15000.50',
      cost_date: '2026-10-02T00:00:00.000000Z',
      description: 'نقل من الميناء',
      purchase_order_id: 3,
      treasury_transaction_id: null,
    },
  ],
};

function mockDetail({
  user,
  data = vehicle,
  hist = { ...history, costs: null },
}: {
  user: AuthUser;
  data?: Vehicle;
  hist?: VehicleHistory;
}) {
  server.use(
    http.get(`${API}/auth/me`, () => laravel.ok(user)),
    http.get(`${API}/vehicles/42`, () => laravel.ok(data)),
    http.get(`${API}/vehicles/42/history`, () => laravel.ok(hist)),
  );
}

afterEach(() => {
  localStorage.clear();
  apiSession.setToken(null);
});

describe('vehicle detail', () => {
  it('shows the vehicle, its images and details', async () => {
    mockDetail({ user: makeUser(['vehicles.view']) });
    renderApp({ route: '/vehicles/42', session });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Toyota Corolla 2024' }),
    ).toBeInTheDocument();
    expect(screen.getByText('STK000042')).toBeInTheDocument();
    expect(screen.getByText('محجوزة')).toBeInTheDocument();

    // Primary image first.
    expect(screen.getByRole('img', { name: 'صورة 1 من 2 لـ Toyota Corolla 2024' })).toHaveAttribute(
      'src',
      'http://localhost:8000/storage/vehicles/42/front.jpg',
    );

    const details = screen.getByRole('heading', { name: 'البيانات الأساسية' })
      .parentElement as HTMLElement;
    expect(within(details).getByText('JTDBR32E720123456')).toBeInTheDocument();
    expect(within(details).getByText('CVT')).toBeInTheDocument();
    expect(within(details).getByText('هايبرد')).toBeInTheDocument();
    expect(within(details).getByText('المتحدة للسيارات')).toBeInTheDocument();
    expect(within(details).getByText('12,500 كم')).toBeInTheDocument();

    expect(screen.getByText('فبريكا بالكامل')).toBeInTheDocument();
    expect(screen.getByText('فتحة سقف')).toBeInTheDocument();
    await waitFor(() => {
      expect(document.title).toBe('STK000042 · Toyota Corolla 2024 | Test CDMS');
    });
  });

  it('switches the large image from the thumbnails', async () => {
    mockDetail({ user: makeUser(['vehicles.view']) });
    const { user } = renderApp({ route: '/vehicles/42', session });

    await user.click(await screen.findByRole('button', { name: 'عرض الصورة 2' }));

    expect(screen.getByRole('img', { name: 'صورة 2 من 2 لـ Toyota Corolla 2024' })).toHaveAttribute(
      'src',
      'http://localhost:8000/storage/vehicles/42/side.jpg',
    );
    expect(screen.getByRole('button', { name: 'عرض الصورة 2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows status history and transfers', async () => {
    mockDetail({ user: makeUser(['vehicles.view']) });
    renderApp({ route: '/vehicles/42', session });

    const timeline = (await screen.findByRole('heading', { name: 'سجل الحالات' }))
      .parentElement as HTMLElement;
    const entries = within(timeline).getAllByRole('listitem');
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent('متاحة');
    expect(entries[0]).toHaveTextContent('بواسطة Sara Sales');
    expect(entries[0]).toHaveTextContent('عن طريق حجز');
    expect(entries[1]).toHaveTextContent('تسجيل العربية');
    expect(entries[1]).toHaveTextContent('تسجيل من أمر شراء');

    const movements = screen.getByRole('heading', { name: 'التحويلات بين الفروع' })
      .parentElement as HTMLElement;
    expect(within(movements).getByText('TRF-2026-000004')).toBeInTheDocument();
    expect(within(movements).getByText('الشيخ زايد ← مدينة نصر')).toBeInTheDocument();
    expect(within(movements).getByText('تم الاستلام')).toBeInTheDocument();
  });

  it('hides all cost information without vehicles.view-cost', async () => {
    mockDetail({ user: makeUser(['vehicles.view']) });
    renderApp({ route: '/vehicles/42', session });

    await screen.findByRole('heading', { name: 'سجل الحالات' });
    expect(screen.getByText('سعر البيع')).toBeInTheDocument();
    expect(screen.queryByText('إجمالي التكلفة')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'التكاليف الإضافية' })).not.toBeInTheDocument();
  });

  it('shows prices and the costs breakdown with vehicles.view-cost', async () => {
    mockDetail({
      user: makeUser(['vehicles.view', 'vehicles.view-cost']),
      data: costView,
      hist: history,
    });
    renderApp({ route: '/vehicles/42', session });

    const pricing = (await screen.findByRole('heading', { name: 'السعر والتكلفة' }))
      .parentElement as HTMLElement;
    expect(within(pricing).getByText('إجمالي التكلفة')).toBeInTheDocument();
    expect(within(pricing).getByText(/1,015,000\.50/)).toBeInTheDocument();

    const costs = (await screen.findByRole('heading', { name: 'التكاليف الإضافية' }))
      .parentElement as HTMLElement;
    expect(within(costs).getByText('نقل')).toBeInTheDocument();
    expect(within(costs).getByText('نقل من الميناء')).toBeInTheDocument();
    expect(within(costs).getByText('15,000.50')).toBeInTheDocument();
  });

  it('shows 404 for a missing vehicle and for an invalid id without calling the API', async () => {
    server.use(
      http.get(`${API}/auth/me`, () => laravel.ok(makeUser(['vehicles.view']))),
      http.get(`${API}/vehicles/999`, () => laravel.error(404, 'Not found')),
    );
    const { unmount } = renderApp({ route: '/vehicles/999', session });
    expect(await screen.findByRole('heading', { name: 'الصفحة غير موجودة' })).toBeInTheDocument();
    unmount();

    renderApp({ route: '/vehicles/abc', session });
    expect(await screen.findByRole('heading', { name: 'الصفحة غير موجودة' })).toBeInTheDocument();
  });

  it("shows 403 for another branch's vehicle", async () => {
    server.use(
      http.get(`${API}/auth/me`, () => laravel.ok(makeUser(['vehicles.view']))),
      http.get(`${API}/vehicles/42`, () => laravel.error(403, 'Forbidden')),
    );
    renderApp({ route: '/vehicles/42', session });

    expect(await screen.findByRole('heading', { name: 'غير مسموح' })).toBeInTheDocument();
  });

  it('opens from the list and returns to the same filtered list', async () => {
    mockDetail({ user: makeUser(['vehicles.view']) });
    server.use(
      http.get(`${API}/vehicles`, () => laravel.paginated([vehicle])),
      http.get(`${API}/vehicle-brands`, () => laravel.paginated([])),
    );
    const { user, router } = renderApp({ route: '/vehicles?status=reserved&page=1', session });

    await user.click(await screen.findByRole('link', { name: /Toyota Corolla/ }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Toyota Corolla 2024' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/vehicles/42');

    await user.click(screen.getByRole('link', { name: /الرجوع للمخزون/ }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/vehicles');
    });
    expect(router.state.location.search).toBe('?status=reserved&page=1');
  });
});
