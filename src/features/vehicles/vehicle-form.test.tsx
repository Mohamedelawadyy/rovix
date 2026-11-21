import { screen, waitFor, within } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import { http } from 'msw/http';
import type { AuthUser } from '@/features/auth/types';
import { apiSession } from '@/lib/api';
import { laravel } from '@/test/msw/laravel';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render-app';
import type { Vehicle } from './types';

const API = '*/api/v1';
const session = { token: 't', expiresAt: '2099-01-01T00:00:00Z' };

function makeUser(permissions: string[]): AuthUser {
  return {
    id: 3,
    name: 'Pola Purchasing',
    email: 'p@x.co',
    phone: null,
    is_active: true,
    locale: 'ar',
    last_login_at: null,
    created_at: '',
    roles: ['Purchasing Employee'],
    permissions,
    branches: [{ id: 1, name: 'مدينة نصر', code: 'NSR' }],
  };
}

const purchasing = makeUser([
  'vehicles.view',
  'vehicles.create',
  'vehicles.update',
  'vehicles.view-cost',
  'suppliers.view',
]);

const saved: Vehicle = {
  id: 77,
  stock_number: 'STK000077',
  brand: { id: 1, name: 'Toyota' },
  model: { id: 12, name: 'Yaris' },
  year: 2025,
  vin: 'JTDBR32E720123456',
  engine_number: null,
  color: 'أحمر',
  mileage: 0,
  transmission: 'automatic',
  fuel_type: 'petrol',
  vehicle_type: 'hatchback',
  purchase_price: '800000.00',
  additional_costs: '0.00',
  total_cost: '800000.00',
  selling_price: '950000.00',
  purchase_date: null,
  supplier: { id: 5, name: 'المتحدة للسيارات' },
  branch: { id: 1, name: 'مدينة نصر' },
  description: null,
  specifications: null,
  status: 'available',
  images: [],
  created_at: '2026-11-21T10:00:00+02:00',
  updated_at: '2026-11-21T10:00:00+02:00',
};

function mockLookups(user: AuthUser) {
  server.use(
    http.get(`${API}/auth/me`, () => laravel.ok(user)),
    http.get(`${API}/vehicle-brands`, () =>
      laravel.paginated([
        { id: 1, name: 'Toyota', country: null, is_active: true },
        { id: 2, name: 'Hyundai', country: null, is_active: true },
      ]),
    ),
    http.get(`${API}/vehicle-models`, ({ request }) =>
      laravel.paginated(
        new URL(request.url).searchParams.get('filter[brand_id]') === '1'
          ? [
              { id: 11, brand_id: 1, name: 'Corolla', is_active: true },
              { id: 12, brand_id: 1, name: 'Yaris', is_active: true },
            ]
          : [{ id: 21, brand_id: 2, name: 'Tucson', is_active: true }],
      ),
    ),
    http.get(`${API}/suppliers`, () => laravel.paginated([{ id: 5, name: 'المتحدة للسيارات' }])),
    http.get(`${API}/vehicles/77`, () => laravel.ok(saved)),
    http.get(`${API}/vehicles/77/history`, () =>
      laravel.ok({ status_history: [], movements: [], costs: [] }),
    ),
  );
}

/** Brands load asynchronously: wait for the option before choosing it. */
async function chooseBrand(user: UserEvent, name: string) {
  const option = await screen.findByRole('option', { name });
  await user.selectOptions(screen.getByLabelText('الماركة'), option);
}

afterEach(() => {
  localStorage.clear();
  apiSession.setToken(null);
});

describe('add vehicle', () => {
  it('is offered on the list only to users with vehicles.create', async () => {
    mockLookups(makeUser(['vehicles.view']));
    server.use(http.get(`${API}/vehicles`, () => laravel.paginated([])));
    const { unmount } = renderApp({ route: '/vehicles', session });
    await screen.findByRole('heading', { name: 'المخزون فاضي' });
    expect(screen.queryByRole('link', { name: /إضافة عربية/ })).not.toBeInTheDocument();
    unmount();
    localStorage.clear();

    mockLookups(purchasing);
    const { user, router } = renderApp({ route: '/vehicles', session });
    await user.click(await screen.findByRole('link', { name: /إضافة عربية/ }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'إضافة عربية' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/vehicles/new');
  });

  it('shows 403 on /vehicles/new without vehicles.create', async () => {
    mockLookups(makeUser(['vehicles.view']));
    renderApp({ route: '/vehicles/new', session });

    expect(await screen.findByRole('heading', { name: 'غير مسموح' })).toBeInTheDocument();
  });

  it('validates on the client before sending anything', async () => {
    let posted = false;
    mockLookups(purchasing);
    server.use(
      http.post(`${API}/vehicles`, () => {
        posted = true;
        return laravel.created(saved);
      }),
    );
    const { user } = renderApp({ route: '/vehicles/new', session });

    await user.click(await screen.findByRole('button', { name: 'حفظ العربية' }));

    const brand = screen.getByLabelText('الماركة');
    expect(brand).toHaveAttribute('aria-invalid', 'true');
    expect(brand).toHaveAccessibleDescription('الحقل ده مطلوب.');
    expect(screen.getByLabelText('سنة الصنع')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('نوع العربية')).toHaveAttribute('aria-invalid', 'true');
    // Single-branch user: branch is pre-selected.
    expect(screen.getByLabelText('الفرع')).toHaveValue('1');
    expect(posted).toBe(false);
  });

  it('creates a vehicle and opens its page with a confirmation', async () => {
    let body: unknown;
    mockLookups(purchasing);
    server.use(
      http.post(`${API}/vehicles`, async ({ request }) => {
        body = await request.json();
        return laravel.created(saved);
      }),
    );
    const { user, router } = renderApp({ route: '/vehicles/new', session });

    const model = await screen.findByLabelText('الموديل');
    expect(model).toBeDisabled();
    await chooseBrand(user, 'Toyota');
    await user.selectOptions(model, await screen.findByRole('option', { name: 'Yaris' }));
    await user.type(screen.getByLabelText('سنة الصنع'), '2025');
    await user.type(screen.getByLabelText(/رقم الشاسيه/), 'jtdbr32e720123456');
    await user.selectOptions(screen.getByLabelText('نوع العربية'), 'هاتشباك');
    await user.selectOptions(screen.getByLabelText('الوقود'), 'بنزين');
    await user.selectOptions(screen.getByLabelText('ناقل الحركة'), 'أوتوماتيك');
    await user.type(screen.getByLabelText(/^اللون/), 'أحمر');
    await user.type(screen.getByLabelText(/سعر الشراء/), '800000');
    await user.type(screen.getByLabelText(/سعر البيع/), '950000');
    await user.selectOptions(screen.getByLabelText(/المورد/), 'المتحدة للسيارات');
    await user.click(screen.getByRole('button', { name: /إضافة خاصية/ }));
    await user.type(screen.getByLabelText('الخاصية'), 'فتحة سقف');
    await user.type(screen.getByLabelText('القيمة'), 'نعم');

    await user.click(screen.getByRole('button', { name: 'حفظ العربية' }));

    expect(await screen.findByRole('status')).toHaveTextContent('تمت إضافة العربية.');
    expect(router.state.location.pathname).toBe('/vehicles/77');
    expect(body).toEqual({
      brand_id: 1,
      model_id: 12,
      year: 2025,
      vin: 'JTDBR32E720123456',
      engine_number: null,
      color: 'أحمر',
      transmission: 'automatic',
      fuel_type: 'petrol',
      vehicle_type: 'hatchback',
      selling_price: '950000',
      purchase_date: null,
      supplier_id: 5,
      description: null,
      specifications: { 'فتحة سقف': 'نعم' },
      branch_id: 1,
      purchase_price: '800000',
    });
  });

  it('clears the model when the brand changes', async () => {
    mockLookups(purchasing);
    const { user } = renderApp({ route: '/vehicles/new', session });

    await chooseBrand(user, 'Toyota');
    const model = screen.getByLabelText('الموديل');
    await user.selectOptions(model, await screen.findByRole('option', { name: 'Corolla' }));
    await chooseBrand(user, 'Hyundai');

    await waitFor(() => {
      expect(model).toHaveValue('');
    });
    expect(within(model).getByRole('option', { name: 'Tucson' })).toBeInTheDocument();
  });

  it('puts server validation errors on their fields and others in the form alert', async () => {
    mockLookups(purchasing);
    server.use(
      http.post(`${API}/vehicles`, () =>
        laravel.validation({
          vin: ['رقم الشاسيه مستخدم قبل كده.'],
          status: ['الحالة تتغير من خلال الإجراءات فقط.'],
        }),
      ),
    );
    const { user } = renderApp({ route: '/vehicles/new', session });

    await chooseBrand(user, 'Toyota');
    await user.selectOptions(
      screen.getByLabelText('الموديل'),
      await screen.findByRole('option', { name: 'Corolla' }),
    );
    await user.type(screen.getByLabelText('سنة الصنع'), '2024');
    await user.type(screen.getByLabelText(/رقم الشاسيه/), 'JTDBR32E720123456');
    await user.selectOptions(screen.getByLabelText('نوع العربية'), 'سيدان');
    await user.selectOptions(screen.getByLabelText('الوقود'), 'بنزين');
    await user.selectOptions(screen.getByLabelText('ناقل الحركة'), 'مانيوال');
    await user.click(screen.getByRole('button', { name: 'حفظ العربية' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'الحالة تتغير من خلال الإجراءات فقط.',
    );
    const vin = screen.getByLabelText(/رقم الشاسيه/);
    expect(vin).toHaveAttribute('aria-invalid', 'true');
    expect(vin).toHaveAccessibleDescription('رقم الشاسيه مستخدم قبل كده.');
    expect(vin).toHaveFocus();
  });

  it('hides the purchase price without vehicles.view-cost', async () => {
    mockLookups(makeUser(['vehicles.view', 'vehicles.create']));
    renderApp({ route: '/vehicles/new', session });

    await screen.findByLabelText('الماركة');
    expect(screen.queryByLabelText(/سعر الشراء/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/المورد/)).not.toBeInTheDocument();
  });
});

describe('edit vehicle', () => {
  it('prefills the form, sends only editable fields and confirms', async () => {
    let body: Record<string, unknown> | undefined;
    mockLookups(purchasing);
    server.use(
      http.put(`${API}/vehicles/77`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return laravel.ok({
          ...saved,
          selling_price: '990000.00',
          updated_at: '2026-11-21T11:00:00+02:00',
        });
      }),
    );
    const { user, router } = renderApp({ route: '/vehicles/77', session });

    await user.click(await screen.findByRole('link', { name: 'تعديل' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'تعديل Toyota Yaris 2025' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('الماركة')).toHaveValue('1');
    await waitFor(() => {
      expect(screen.getByLabelText('الموديل')).toHaveValue('12');
    });
    expect(screen.queryByLabelText('الفرع')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/سعر الشراء/)).not.toBeInTheDocument();

    const price = screen.getByLabelText(/سعر البيع/);
    await user.clear(price);
    await user.type(price, '990000');
    await user.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));

    expect(await screen.findByRole('status')).toHaveTextContent('تم حفظ التعديلات.');
    expect(router.state.location.pathname).toBe('/vehicles/77');
    expect(body).toMatchObject({
      brand_id: 1,
      model_id: 12,
      selling_price: '990000',
      supplier_id: 5,
    });
    expect(body).not.toHaveProperty('branch_id');
    expect(body).not.toHaveProperty('purchase_price');
  });

  it('hides the edit button and blocks the edit page without vehicles.update', async () => {
    mockLookups(makeUser(['vehicles.view']));
    const { unmount } = renderApp({ route: '/vehicles/77', session });
    await screen.findByRole('heading', { level: 1, name: 'Toyota Yaris 2025' });
    expect(screen.queryByRole('link', { name: 'تعديل' })).not.toBeInTheDocument();
    unmount();

    renderApp({ route: '/vehicles/77/edit', session });
    expect(await screen.findByRole('heading', { name: 'غير مسموح' })).toBeInTheDocument();
  });

  it('shows non-validation failures in the form alert and keeps the input', async () => {
    mockLookups(purchasing);
    server.use(
      http.put(`${API}/vehicles/77`, () => laravel.error(403, 'لا يمكنك تعديل عربية في فرع آخر.')),
    );
    const { user } = renderApp({ route: '/vehicles/77/edit', session });

    const color = await screen.findByLabelText(/^اللون/);
    await user.clear(color);
    await user.type(color, 'رمادي');
    await user.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('لا يمكنك تعديل عربية في فرع آخر.');
    expect(color).toHaveValue('رمادي');
  });
});
