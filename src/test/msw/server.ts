import { http } from 'msw/http';
import { setupServer } from 'msw/node';
import { laravel } from './laravel';

/**
 * Baseline handlers kept across `server.resetHandlers()`. Only for screens many tests land on
 * incidentally (the dashboard is the home page after login); tests that are about those
 * screens override them with `server.use(...)`.
 */
export const emptyDashboard = {
  overview: {
    vehicles: { total: 0, available: 0, sold: 0, reserved: 0, under_maintenance: 0, in_transit: 0 },
    sales: { contracts: 0, total_sales: '0.00' },
    total_collections: '0.00',
    outstanding_customer_balances: '0.00',
    overdue_installments: { count: 0, amount: '0.00' },
    expenses: { total_paid: '0.00', pending_approvals: 0 },
    active_customers: 0,
  },
  sales: { monthly: [], by_branch: [], by_brand: [], by_payment_type: [] },
  inventory: { by_status: [], by_branch: [], by_brand: [] },
  financial: {
    monthly_receipts_vs_payments: [],
    installment_collection: { due_total: '0', collected_total: '0', paid_count: 0, total_count: 0 },
  },
  tables: {
    recent_sales: [],
    latest_purchases: [],
    upcoming_installments: [],
    overdue_payments: [],
    recent_transactions: [],
    recent_activities: [],
  },
} as const;

const baseline = (Object.keys(emptyDashboard) as (keyof typeof emptyDashboard)[]).map((section) =>
  http.get(`*/api/v1/dashboard/${section}`, () => laravel.ok(emptyDashboard[section])),
);

/** Shared MSW server for tests. Add handlers per test with `server.use(...)`. */
export const server = setupServer(...baseline);
