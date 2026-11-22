import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw/http';
import type { AuthUser } from '@/features/auth/types';
import { apiSession } from '@/lib/api';
import { laravel } from '@/test/msw/laravel';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render-app';
import type { SalesContract } from './types';

const API = '*/api/v1';
const session = { token: 't', expiresAt: '2099-01-01T00:00:00Z' };

function makeUser(permissions: string[]): AuthUser {
  return {
    id: 4,
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

const manager = makeUser([
  'vehicles.view',
  'customers.view',
  'sales-contracts.view',
  'sales-contracts.create',
  'sales-contracts.cancel',
  'employees.view',
  'cashboxes.view',
  'treasury.create',
]);

const vehicle = {
  id: 77,
  stock_number: 'STK000077',
  brand: { id: 1, name: 'Toyota' },
  model: { id: 12, name: 'Yaris' },
  year: 2025,
  vin: null,
  color: 'أحمر',
  status: 'available',
  selling_price: '950000.00',
  branch: { id: 1, name: 'مدينة نصر' },
};

const contract: SalesContract = {
  id: 3,
  number: 'SC000003',
  customer: { id: 9, name: 'أحمد علي', customer_code: 'CUS000009', phone: '01001234567' },
  vehicle: {
    id: 77,
    stock_number: 'STK000077',
    vin: null,
    brand: 'Toyota',
    model: 'Yaris',
    year: 2025,
  },
  branch: { id: 1, name: 'مدينة نصر' },
  sales_employee: { id: 2, name: 'منى', employee_code: 'EMP2' },
  contract_date: '2026-11-21',
  payment_type: 'cash',
  selling_price: '950000.00',
  discount: '0.00',
  final_amount: '950000.00',
  down_payment: '0.00',
  paid_amount: '500000.00',
  outstanding_amount: '450000.00',
  currency: 'EGP',
  status: 'active',
  notes: null,
  reservation_id: null,
  payment_plan: null,
  status_history: [],
  cancelled_at: null,
  cancellation_reason: null,
  created_at: '2026-11-21T10:00:00+02:00',
};

function mockLookups(user: AuthUser) {
  server.use(
    http.get(`${API}/auth/me`, () => laravel.ok(user)),
    http.get(`${API}/settings/lookups`, () =>
      laravel.ok({
        locales: ['ar'],
        currency: 'EGP',
        payment_methods: ['cash', 'bank_transfer'],
        installment_frequencies: ['monthly', 'quarterly'],
      }),
    ),
    http.get(`${API}/vehicles`, () => laravel.paginated([vehicle])),
    http.get(`${API}/vehicles/77`, () => laravel.ok(vehicle)),
    http.get(`${API}/customers`, () =>
      laravel.paginated([
        {
          id: 9,
          customer_code: 'CUS000009',
          name: 'أحمد علي',
          phone: '01001234567',
          status: 'active',
        },
      ]),
    ),
    http.get(`${API}/employees`, ({ request }) => {
      expect(new URL(request.url).searchParams.get('filter[branch_id]')).toBe('1');
      return laravel.paginated([{ id: 2, name: 'منى', employee_code: 'EMP2', user_id: 4 }]);
    }),
    http.get(`${API}/cashboxes`, () =>
      laravel.paginated([{ id: 1, name: 'خزنة الفرع', code: 'CB1' }]),
    ),
    http.get(`${API}/sales-contracts/3`, () => laravel.ok(contract)),
    http.get(`${API}/sales-contracts/3/payments`, () =>
      laravel.ok({
        final_amount: '950000.00',
        paid_amount: '500000.00',
        outstanding_amount: '450000.00',
        transactions: [],
      }),
    ),
  );
}

afterEach(() => {
  localStorage.clear();
  apiSession.setToken(null);
});

describe('create sales contract', () => {
  it('creates an installment contract with a generated schedule', async () => {
    let body: Record<string, unknown> = {};
    mockLookups(manager);
    server.use(
      http.post(`${API}/sales-contracts`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return laravel.created({ ...contract, payment_type: 'installment' });
      }),
    );
    const { user, router } = renderApp({ route: '/sales-contracts/new', session });

    const vehicles = await screen.findByRole('list', { name: 'العربية' });
    await user.click(within(vehicles).getByRole('button', { name: /Toyota Yaris 2025/ }));
    const customers = await screen.findByRole('list', { name: 'العميل' });
    await user.click(within(customers).getByRole('button', { name: /أحمد علي/ }));

    // The vehicle's price is suggested and the user's own employee record preselected.
    expect(screen.getByLabelText('سعر البيع')).toHaveValue('950000.00');
    await waitFor(() => {
      expect(screen.getByLabelText(/موظف المبيعات/)).toHaveValue('2');
    });

    await user.selectOptions(screen.getByLabelText('طريقة الدفع'), 'installment');
    await user.type(screen.getByLabelText(/^المقدم/), '350000');
    await user.selectOptions(await screen.findByLabelText('الخزنة'), '1');
    await user.selectOptions(screen.getByLabelText('طريقة السداد'), 'cash');
    await user.selectOptions(screen.getByLabelText('تكرار الأقساط'), 'monthly');
    await user.type(screen.getByLabelText('تاريخ أول قسط'), '2027-01-15');
    await user.type(screen.getByLabelText('عدد الأقساط'), '3');
    await user.click(screen.getByRole('button', { name: 'إنشاء الجدول' }));

    expect(screen.getByLabelText('قيمة القسط 3')).toHaveValue('200000.00');
    expect(screen.getByLabelText('استحقاق القسط 3')).toHaveValue('2027-03-15');

    await user.click(screen.getByRole('button', { name: 'تسجيل العقد' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/sales-contracts/3');
    });
    expect(body).toMatchObject({
      vehicle_id: 77,
      customer_id: 9,
      sales_employee_id: 2,
      payment_type: 'installment',
      selling_price: '950000.00',
      down_payment: '350000',
      down_payment_receipt: { cashbox_id: 1, payment_method: 'cash', reference: null },
      installment_frequency: 'monthly',
      start_date: '2027-01-15',
      number_of_installments: 3,
      installments: [
        { amount: '200000.00', due_date: '2027-01-15' },
        { amount: '200000.00', due_date: '2027-02-15' },
        { amount: '200000.00', due_date: '2027-03-15' },
      ],
    });
    expect(body).not.toHaveProperty('payment');
    expect(await screen.findByText('تم تسجيل عقد البيع.')).toBeInTheDocument();
  });

  it('preselects the vehicle and shows 409 business errors', async () => {
    mockLookups(manager);
    server.use(
      http.post(`${API}/sales-contracts`, () =>
        laravel.conflict(
          'vehicle_reserved_for_other_customer',
          'السيارة محجوزة لعميل آخر. يجب إلغاء الحجز أولاً.',
        ),
      ),
    );
    const { user } = renderApp({ route: '/sales-contracts/new?vehicle_id=77', session });

    await screen.findByRole('button', { name: 'تغيير: العربية' });
    const customers = await screen.findByRole('list', { name: 'العميل' });
    await user.click(within(customers).getByRole('button', { name: /أحمد علي/ }));
    await waitFor(() => {
      expect(screen.getByLabelText(/موظف المبيعات/)).toHaveValue('2');
    });
    await user.type(screen.getByLabelText('سعر البيع'), '950000');
    await user.selectOptions(screen.getByLabelText('طريقة الدفع'), 'cash');
    await user.type(screen.getByLabelText(/المبلغ المدفوع/), '950000');
    await user.selectOptions(await screen.findByLabelText('الخزنة'), '1');
    await user.selectOptions(screen.getByLabelText('طريقة السداد'), 'cash');
    await user.click(screen.getByRole('button', { name: 'تسجيل العقد' }));

    expect(await screen.findByText(/السيارة محجوزة لعميل آخر/)).toBeInTheDocument();
  });

  it('explains when the user cannot load employees', async () => {
    mockLookups(makeUser(['sales-contracts.view', 'sales-contracts.create', 'vehicles.view']));
    renderApp({ route: '/sales-contracts/new', session });
    expect(await screen.findByText(/قايمة الموظفين/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'تسجيل العقد' })).toBeDisabled();
  });
});

describe('contract details', () => {
  it('records a payment on a cash contract', async () => {
    let body: unknown;
    mockLookups(manager);
    server.use(
      http.post(`${API}/sales-contracts/3/payments`, async ({ request }) => {
        body = await request.json();
        return laravel.created({ receipt: {}, contract });
      }),
    );
    const { user } = renderApp({ route: '/sales-contracts/3', session });

    await user.click(await screen.findByRole('button', { name: 'تسجيل دفعة' }));
    const dialog = screen.getByRole('dialog', { name: 'تسجيل دفعة على العقد' });
    const amount = within(dialog).getByLabelText(/المبلغ المدفوع/);
    await user.type(amount, '450000.01');
    await user.selectOptions(await within(dialog).findByLabelText('الخزنة'), '1');
    await user.selectOptions(within(dialog).getByLabelText('طريقة السداد'), 'bank_transfer');
    await user.click(within(dialog).getByRole('button', { name: 'تسجيل الدفعة' }));
    expect(amount).toHaveAccessibleDescription('المبلغ أكبر من قيمة العقد.');
    expect(body).toBeUndefined();

    await user.clear(amount);
    await user.type(amount, '450000');
    await user.click(within(dialog).getByRole('button', { name: 'تسجيل الدفعة' }));

    expect(await screen.findByText('تم تسجيل الدفعة.')).toBeInTheDocument();
    expect(body).toMatchObject({
      amount: '450000',
      cashbox_id: 1,
      payment_method: 'bank_transfer',
    });
  });

  it('shows the installment schedule and hides actions without permissions', async () => {
    mockLookups(makeUser(['sales-contracts.view']));
    server.use(
      http.get(`${API}/sales-contracts/3`, () =>
        laravel.ok({
          ...contract,
          payment_type: 'installment',
          payment_plan: {
            down_payment: '350000.00',
            remaining_balance: '600000.00',
            number_of_installments: 1,
            installment_frequency: 'monthly',
            start_date: '2026-12-21',
            installments: [
              {
                id: 1,
                installment_number: 1,
                amount: '600000.00',
                due_date: '2026-12-21',
                paid_amount: '0.00',
                remaining_amount: '600000.00',
                status: 'pending',
              },
            ],
          },
        }),
      ),
    );
    renderApp({ route: '/sales-contracts/3', session });
    expect(await screen.findByRole('table', { name: 'جدول الأقساط' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'تسجيل دفعة' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'إلغاء العقد' })).not.toBeInTheDocument();
  });

  it('cancels with a reason', async () => {
    let body: unknown;
    let current = contract;
    mockLookups(manager);
    server.use(
      http.get(`${API}/sales-contracts/3`, () => laravel.ok(current)),
      http.post(`${API}/sales-contracts/3/cancel`, async ({ request }) => {
        body = await request.json();
        current = { ...contract, status: 'cancelled', cancellation_reason: 'العميل رجع في كلامه' };
        return laravel.ok(current);
      }),
    );
    const { user } = renderApp({ route: '/sales-contracts/3', session });

    await user.click(await screen.findByRole('button', { name: 'إلغاء العقد' }));
    const dialog = screen.getByRole('dialog', { name: 'إلغاء عقد البيع' });
    expect(dialog).toHaveAccessibleDescription(/الفلوس اللي اتدفعت مش بترجع تلقائي/);
    await user.type(within(dialog).getByLabelText('سبب الإلغاء'), 'العميل رجع في كلامه');
    await user.click(within(dialog).getByRole('button', { name: 'إلغاء العقد' }));

    expect(await screen.findByText('تم إلغاء العقد، والعربية رجعت متاحة.')).toBeInTheDocument();
    expect(body).toEqual({ reason: 'العميل رجع في كلامه' });
    expect(screen.queryByRole('button', { name: 'إلغاء العقد' })).not.toBeInTheDocument();
  });
});
