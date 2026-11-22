import { api } from '@/lib/api';
import { normalizeMoney } from '@/lib/money/money';

/**
 * GET /dashboard/{section} (dashboard.view). Rows come from raw SQL aggregates
 * (Modules/Dashboard/app/Services/DashboardQueryService.php), so counts may arrive as numbers
 * or numeric strings and sums as decimal strings (or null for an empty group). The helpers
 * below normalize them before display.
 */
type Num = number | string | null;

/** A type alias (not an interface) so it is assignable to the client's QueryParams. */
export type DashboardFilters = {
  date_from?: string;
  date_to?: string;
  branch_id?: number;
};

export interface Overview {
  vehicles: {
    total: number;
    available: number;
    sold: number;
    reserved: number;
    under_maintenance: number;
    in_transit: number;
  };
  sales: { contracts: number; total_sales: string };
  total_collections: string;
  outstanding_customer_balances: string;
  overdue_installments: { count: number; amount: string };
  expenses: { total_paid: string; pending_approvals: number };
  active_customers: number;
}

export interface SalesBreakdown {
  monthly: { month: string; contracts: Num; total: Num }[];
  by_branch: { id: number; name: string; contracts: Num; total: Num }[];
  by_brand: { id: number; name: string; contracts: Num; total: Num }[];
  by_payment_type: { payment_type: string; contracts: Num; total: Num }[];
}

export interface InventoryBreakdown {
  by_brand: { name: string; in_stock: Num }[];
}

export interface Financial {
  monthly_receipts_vs_payments: { month: string; receipts: Num; payments: Num }[];
  installment_collection: {
    due_total: Num;
    collected_total: Num;
    paid_count: Num;
    total_count: Num;
  } | null;
}

export interface DashboardTables {
  recent_sales: {
    id: number;
    number: string;
    contract_date: string;
    final_amount: Num;
    payment_type: string;
    status: string;
    customer: string;
    stock_number: string;
  }[];
  upcoming_installments: InstallmentRow[];
  overdue_payments: InstallmentRow[];
  recent_transactions: {
    id: number;
    number: string;
    type: 'receipt' | 'payment';
    category: string;
    amount: Num;
    transaction_date: string;
    party_name: string | null;
    status: string;
  }[];
}

export interface InstallmentRow {
  id: number;
  sales_contract_id: number;
  installment_number: Num;
  due_date: string;
  remaining_amount: Num;
  customer: string;
}

const get = <T>(section: string, filters: DashboardFilters, signal?: AbortSignal) =>
  api.get<T>(`/dashboard/${section}`, { query: filters, ...(signal ? { signal } : {}) });

export const dashboardApi = {
  overview: (f: DashboardFilters, s?: AbortSignal) => get<Overview>('overview', f, s),
  sales: (f: DashboardFilters, s?: AbortSignal) => get<SalesBreakdown>('sales', f, s),
  inventory: (f: DashboardFilters, s?: AbortSignal) => get<InventoryBreakdown>('inventory', f, s),
  financial: (f: DashboardFilters, s?: AbortSignal) => get<Financial>('financial', f, s),
  tables: (f: DashboardFilters, s?: AbortSignal) => get<DashboardTables>('tables', f, s),
};

export const dashboardKeys = {
  section: (section: string, filters: DashboardFilters) => ['dashboard', section, filters] as const,
};

export function toCount(value: Num | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Decimal string with 2 places; tolerates numbers, nulls and longer SQL scales. */
export function toMoney(value: Num | undefined): string {
  if (value === null || value === undefined || value === '') return '0.00';
  try {
    return normalizeMoney(value);
  } catch {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(2) : '0.00';
  }
}
