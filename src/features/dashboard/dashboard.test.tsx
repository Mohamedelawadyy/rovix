import { screen, waitFor, within } from '@testing-library/react';
import { http } from 'msw/http';
import type { AuthUser } from '@/features/auth/types';
import { apiSession } from '@/lib/api';
import { laravel } from '@/test/msw/laravel';
import { emptyDashboard, server } from '@/test/msw/server';
import { renderApp } from '@/test/render-app';
import { toMoney } from './api';
import { parseDashboardParams, periodRange, toSearchParams } from './filters';

const API = '*/api/v1';
const session = { token: 't', expiresAt: '2099-01-01T00:00:00Z' };

const manager: AuthUser = {
  id: 1,
  name: 'Mona Manager',
  email: 'm@x.co',
  phone: null,
  is_active: true,
  locale: 'ar',
  last_login_at: null,
  created_at: '',
  roles: ['Branch Manager'],
  permissions: ['dashboard.view', 'vehicles.view', 'sales-contracts.view', 'customers.view'],
  branches: [
    { id: 1, name: 'مدينة نصر', code: 'NSR' },
    { id: 2, name: 'المعادي', code: 'MAD' },
  ],
};

afterEach(() => {
  localStorage.clear();
  apiSession.setToken(null);
});

describe('dashboard filters', () => {
  const today = new Date(2026, 10, 22);

  it('computes preset ranges and keeps only custom dates in the URL', () => {
    expect(periodRange('month', today)).toEqual({ date_from: '2026-11-01', date_to: '2026-11-22' });
    expect(periodRange('quarter', today).date_from).toBe('2026-09-01');
    expect(periodRange('year', today).date_from).toBe('2026-01-01');
    expect(periodRange('all', today)).toEqual({});

    const preset = parseDashboardParams(
      new URLSearchParams('period=month&date_from=2020-01-01'),
      today,
    );
    expect(preset.filters).toEqual({ date_from: '2026-11-01', date_to: '2026-11-22' });
    expect(toSearchParams(preset).toString()).toBe('period=month');

    const custom = parseDashboardParams(
      new URLSearchParams('period=custom&date_from=2026-12-01&date_to=2026-01-01&branch_id=2'),
      today,
    );
    expect(custom.filters).toEqual({
      date_from: '2026-01-01',
      date_to: '2026-12-01',
      branch_id: 2,
    });
  });

  it('normalizes SQL aggregate values', () => {
    expect(toMoney(null)).toBe('0.00');
    expect(toMoney('1250000.5')).toBe('1250000.50');
    expect(toMoney(42)).toBe('42.00');
    expect(toMoney('10.123456')).toBe('10.12');
  });
});

describe('dashboard page', () => {
  it('shows headline numbers, breakdowns and lists, and filters by period and branch', async () => {
    const requests: string[] = [];
    server.use(
      http.get(`${API}/auth/me`, () => laravel.ok(manager)),
      http.get(`${API}/dashboard/overview`, ({ request }) => {
        requests.push(new URL(request.url).search);
        return laravel.ok({
          ...emptyDashboard.overview,
          vehicles: { ...emptyDashboard.overview.vehicles, total: 40, available: 25 },
          sales: { contracts: 3, total_sales: '2850000.00' },
          overdue_installments: { count: 2, amount: '120000.00' },
        });
      }),
      http.get(`${API}/dashboard/sales`, () =>
        laravel.ok({
          ...emptyDashboard.sales,
          monthly: [{ month: '2026-11', contracts: 3, total: '2850000.00' }],
          by_payment_type: [
            { payment_type: 'cash', contracts: 1, total: '950000.00' },
            { payment_type: 'installment', contracts: '2', total: '1900000.00' },
          ],
        }),
      ),
      http.get(`${API}/dashboard/tables`, () =>
        laravel.ok({
          ...emptyDashboard.tables,
          overdue_payments: [
            {
              id: 8,
              sales_contract_id: 3,
              installment_number: 2,
              due_date: '2026-10-01',
              remaining_amount: '60000.00',
              customer: 'أحمد علي',
            },
          ],
        }),
      ),
    );
    const { user, router } = renderApp({ route: '/dashboard', session });

    expect(await screen.findByText('3 عقد')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /25\s*متاحة/ })).toHaveAttribute(
      'href',
      '/vehicles?status=available',
    );
    // Breakdown bars are direct-labeled; the monthly chart has an accessible data table.
    expect(await screen.findByText('تقسيط')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'المبيعات الشهرية' })).toBeInTheDocument();
    const overdue = await screen.findByRole('table', { name: 'أقساط متأخرة' });
    expect(within(overdue).getByRole('link', { name: 'أحمد علي' })).toHaveAttribute(
      'href',
      '/sales-contracts/3',
    );

    await user.selectOptions(screen.getByLabelText('الفترة'), 'year');
    await user.selectOptions(screen.getByLabelText('الفرع'), '2');
    await waitFor(() => {
      expect(router.state.location.search).toBe('?period=year&branch_id=2');
    });
    await waitFor(() => {
      expect(requests.at(-1)).toMatch(/date_from=\d{4}-01-01.*branch_id=2/);
    });
  });

  it('keeps other sections working when one fails', async () => {
    server.use(
      http.get(`${API}/auth/me`, () => laravel.ok(manager)),
      http.get(`${API}/dashboard/financial`, () => laravel.error(500, 'Server Error')),
    );
    renderApp({ route: '/dashboard', session });

    expect(await screen.findAllByText(/تعذر تحميل الجزء ده/)).toHaveLength(2);
    expect(screen.getByText('المخزون الحالي')).toBeInTheDocument();
  });
});
