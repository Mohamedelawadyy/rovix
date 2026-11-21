import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw/http';
import type { AuthUser } from '@/features/auth/types';
import { apiSession } from '@/lib/api';
import { laravel } from '@/test/msw/laravel';
import { server } from '@/test/msw/server';
import { renderApp } from '@/test/render-app';
import type { Customer } from './types';

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

const sales = makeUser(['customers.view', 'customers.create', 'customers.update']);

const ahmed: Customer = {
  id: 9,
  customer_code: 'CUS000009',
  name: 'أحمد علي',
  phone: '01001234567',
  email: 'ahmed@example.com',
  national_id: '**********4567',
  address: 'مدينة نصر',
  notes: null,
  status: 'active',
  branch: { id: 1, name: 'مدينة نصر' },
  created_at: '2026-11-01T10:00:00+02:00',
};

function mockCustomer(user: AuthUser, customer: Customer = ahmed) {
  server.use(
    http.get(`${API}/auth/me`, () => laravel.ok(user)),
    http.get(`${API}/customers/9`, ({ request }) =>
      new URL(request.url).searchParams.get('include') === 'national_id'
        ? laravel.ok({ ...customer, national_id: '29901011234567' })
        : laravel.ok(customer),
    ),
    http.get(`${API}/customers/9/balance`, () =>
      laravel.ok({
        customer_id: 9,
        contracts_count: 1,
        total_contract_amount: '950000.00',
        total_paid: '300000.00',
        outstanding_balance: '650000.00',
      }),
    ),
    http.get(`${API}/customers/9/contracts`, () =>
      laravel.paginated([
        {
          id: 3,
          number: 'SC000003',
          vehicle: {
            id: 77,
            stock_number: 'STK77',
            vin: null,
            brand: 'Toyota',
            model: 'Yaris',
            year: 2025,
          },
          contract_date: '2026-11-10',
          payment_type: 'installment',
          final_amount: '950000.00',
          paid_amount: '300000.00',
          outstanding_amount: '650000.00',
          status: 'active',
        },
      ]),
    ),
    http.get(`${API}/customers/9/payments`, () =>
      laravel.paginated([
        {
          id: 50,
          number: 'RC000050',
          type: 'receipt',
          category: 'down_payment',
          amount: '300000.00',
          payment_method: 'cash',
          transaction_date: '2026-11-10',
          related: { type: 'sales_contract', id: 3 },
          reference: null,
          status: 'posted',
        },
      ]),
    ),
  );
}

afterEach(() => {
  localStorage.clear();
  apiSession.setToken(null);
});

describe('customers list', () => {
  it('lists customers with masked national IDs and searches through the API', async () => {
    const searches: (string | null)[] = [];
    server.use(
      http.get(`${API}/auth/me`, () => laravel.ok(sales)),
      http.get(`${API}/customers`, ({ request }) => {
        searches.push(new URL(request.url).searchParams.get('search'));
        return laravel.paginated([ahmed]);
      }),
    );
    const { user, router } = renderApp({ route: '/customers', session });

    const link = await screen.findByRole('link', { name: 'أحمد علي' });
    const row = link.closest('tr');
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText('**********4567')).toBeInTheDocument();
    expect(screen.getByText('1 عميل')).toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'بحث' }), '0100{Enter}');
    await waitFor(() => {
      expect(router.state.location.search).toBe('?search=0100');
    });
    await waitFor(() => {
      expect(searches).toContain('0100');
    });
  });

  it('hides add and lookup without customers.create', async () => {
    server.use(
      http.get(`${API}/auth/me`, () => laravel.ok(makeUser(['customers.view']))),
      http.get(`${API}/customers`, () => laravel.paginated([])),
    );
    renderApp({ route: '/customers', session });
    await screen.findByRole('heading', { name: 'لسه مفيش عملاء' });
    expect(screen.queryByRole('link', { name: /إضافة عميل/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'بحث برقم قومي' })).not.toBeInTheDocument();
  });
});

describe('customer details', () => {
  it('shows info, balance, contracts and payments', async () => {
    mockCustomer(sales);
    renderApp({ route: '/customers/9', session });

    expect(await screen.findByRole('heading', { level: 1, name: 'أحمد علي' })).toBeInTheDocument();
    expect(await screen.findByText('SC000003')).toBeInTheDocument();
    expect(screen.getByText('تقسيط')).toBeInTheDocument();
    expect(await screen.findByText('RC000050')).toBeInTheDocument();
    expect(screen.getByText('مقدم')).toBeInTheDocument();
    expect(screen.getByText('**********4567')).toBeInTheDocument();
    // No view-sensitive permission: no way to reveal the number.
    expect(screen.queryByRole('button', { name: 'إظهار الرقم' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'حذف العميل' })).not.toBeInTheDocument();
  });

  it('reveals the national ID on demand with customers.view-sensitive', async () => {
    mockCustomer(makeUser(['customers.view', 'customers.view-sensitive']));
    const { user } = renderApp({ route: '/customers/9', session });

    await user.click(await screen.findByRole('button', { name: 'إظهار الرقم' }));
    expect(await screen.findByText('29901011234567')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'إخفاء الرقم' }));
    expect(screen.queryByText('29901011234567')).not.toBeInTheDocument();
    expect(screen.getByText('**********4567')).toBeInTheDocument();
  });

  it('deletes after confirmation and returns to the list', async () => {
    let deleted = false;
    mockCustomer(makeUser(['customers.view', 'customers.delete']));
    server.use(
      http.delete(`${API}/customers/9`, () => {
        deleted = true;
        return laravel.ok(null, 'Deleted');
      }),
      http.get(`${API}/customers`, () => laravel.paginated([])),
    );
    const { user, router } = renderApp({ route: '/customers/9', session });

    await user.click(await screen.findByRole('button', { name: 'حذف العميل' }));
    const dialog = screen.getByRole('dialog', { name: 'حذف العميل' });
    await user.click(within(dialog).getByRole('button', { name: 'حذف' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/customers');
    });
    expect(deleted).toBe(true);
  });

  it('shows 403 for a customer outside the user branches', async () => {
    server.use(
      http.get(`${API}/auth/me`, () => laravel.ok(sales)),
      http.get(`${API}/customers/9`, () => laravel.error(403, 'Forbidden')),
    );
    renderApp({ route: '/customers/9', session });
    expect(await screen.findByRole('heading', { name: 'غير مسموح' })).toBeInTheDocument();
  });
});

describe('customer form', () => {
  it('creates a customer with the user branch preselected', async () => {
    let body: unknown;
    mockCustomer(sales);
    server.use(
      http.post(`${API}/customers`, async ({ request }) => {
        body = await request.json();
        return laravel.created(ahmed);
      }),
    );
    const { user, router } = renderApp({ route: '/customers/new', session });

    await user.type(await screen.findByLabelText('الاسم'), 'أحمد علي');
    await user.type(screen.getByLabelText('الموبايل'), '01001234567');
    await user.click(screen.getByRole('button', { name: 'حفظ العميل' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/customers/9');
    });
    expect(body).toEqual({
      name: 'أحمد علي',
      phone: '01001234567',
      email: null,
      address: null,
      notes: null,
      status: 'active',
      branch_id: 1,
    });
    expect(await screen.findByText('تم إضافة العميل.')).toBeInTheDocument();
  });

  it('maps a duplicate national ID (422) onto the field', async () => {
    mockCustomer(sales);
    server.use(
      http.post(`${API}/customers`, () =>
        laravel.validation({ national_id: ['يوجد عميل مسجل بنفس الرقم القومي.'] }),
      ),
    );
    const { user } = renderApp({ route: '/customers/new', session });

    await user.type(await screen.findByLabelText('الاسم'), 'أحمد');
    await user.type(screen.getByLabelText('الموبايل'), '01001234567');
    await user.type(screen.getByLabelText(/الرقم القومي/), '29901011234567');
    await user.click(screen.getByRole('button', { name: 'حفظ العميل' }));

    const field = screen.getByLabelText(/الرقم القومي/);
    await waitFor(() => {
      expect(field).toHaveAccessibleDescription(/يوجد عميل مسجل بنفس الرقم القومي/);
    });
    expect(field).toHaveAttribute('aria-invalid', 'true');
  });

  it('edits without sending the masked national ID', async () => {
    let body: Record<string, unknown> = {};
    mockCustomer(sales);
    server.use(
      http.put(`${API}/customers/9`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        return laravel.ok({ ...ahmed, phone: '01112223334' });
      }),
    );
    const { user, router } = renderApp({ route: '/customers/9/edit', session });

    const phone = await screen.findByLabelText('الموبايل');
    expect(screen.getByLabelText(/الرقم القومي/)).toHaveValue('');
    expect(screen.getByText(/\*{10}4567/)).toBeInTheDocument();
    await user.clear(phone);
    await user.type(phone, '01112223334');
    await user.click(screen.getByRole('button', { name: 'حفظ التعديلات' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/customers/9');
    });
    expect(body.phone).toBe('01112223334');
    expect(body).not.toHaveProperty('national_id');
    expect(body).not.toHaveProperty('branch_id');
  });
});

describe('national ID lookup', () => {
  function openLookup() {
    server.use(
      http.get(`${API}/auth/me`, () => laravel.ok(sales)),
      http.get(`${API}/customers`, () => laravel.paginated([])),
    );
    return renderApp({ route: '/customers', session });
  }

  it('offers to register a new customer with the number when nothing matches', async () => {
    let body: unknown;
    server.use(
      http.post(`${API}/customers/lookup`, async ({ request }) => {
        body = await request.json();
        return laravel.error(404, 'Not found');
      }),
    );
    const { user, router } = openLookup();

    await user.click(await screen.findByRole('button', { name: 'بحث برقم قومي' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'بحث' }));
    expect(within(dialog).getByLabelText('الرقم القومي')).toHaveAccessibleDescription(
      'الرقم القومي لازم يكون 14 رقم.',
    );
    expect(body).toBeUndefined();

    await user.type(within(dialog).getByLabelText('الرقم القومي'), '29901011234567');
    await user.click(within(dialog).getByRole('button', { name: 'بحث' }));
    await user.click(
      await within(dialog).findByRole('link', { name: 'إضافة عميل جديد بالرقم ده' }),
    );

    expect(body).toEqual({ national_id: '29901011234567', branch_id: 1 });
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/customers/new');
    });
    expect(await screen.findByLabelText(/الرقم القومي/)).toHaveValue('29901011234567');
  });

  it('opens the matched customer', async () => {
    mockCustomer(sales);
    server.use(http.post(`${API}/customers/lookup`, () => laravel.ok(ahmed)));
    const { user, router } = openLookup();

    await user.click(await screen.findByRole('button', { name: 'بحث برقم قومي' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('الرقم القومي'), '29901011234567');
    await user.click(within(dialog).getByRole('button', { name: 'بحث' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/customers/9');
    });
    expect(await screen.findByText('العميل مسجل، واتربط بالفرع.')).toBeInTheDocument();
  });
});
