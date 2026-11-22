import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Card } from '@/components/shared/DetailList';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Select';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/features/auth/auth-context';
import { useBranchOptions } from '@/features/branches/use-branch-options';
import {
  contractStatusLabels,
  labelOf,
  paymentTypeLabels,
  transactionCategoryLabels,
} from '@/features/customers/labels';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getErrorMessage } from '@/lib/api/error-message';
import { formatDate, formatNumber } from '@/lib/format';
import { addMoney, formatMoney, subtractMoney } from '@/lib/money/money';
import { ar, interpolate } from '@/locales/ar';
import {
  dashboardApi,
  dashboardKeys,
  toCount,
  toMoney,
  type DashboardFilters,
  type InstallmentRow,
} from './api';
import { MonthlyColumns, RankedBars } from './charts';
import { monthLabel } from './format';
import { parseDashboardParams, PERIODS, toSearchParams, type Period } from './filters';

const t = ar.dashboard;
const th = 'px-3 py-2 text-start font-medium whitespace-nowrap';
const td = 'px-3 py-2 whitespace-nowrap';

function useSection<T>(
  section: string,
  filters: DashboardFilters,
  fetcher: (f: DashboardFilters, s?: AbortSignal) => Promise<T>,
) {
  return useQuery({
    queryKey: dashboardKeys.section(section, filters),
    queryFn: ({ signal }) => fetcher(filters, signal),
  });
}

/** Loading / error placeholder for one section; each section fails on its own. */
function SectionBody<T>({
  query,
  children,
}: {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
}) {
  if (query.data !== undefined) return <>{children(query.data)}</>;
  if (query.isError) {
    return (
      <Alert tone="danger">
        {t.sectionError} {getErrorMessage(query.error)}
      </Alert>
    );
  }
  return (
    <p role="status" className="text-sm text-fg-muted">
      {ar.common.loading}
    </p>
  );
}

function Kpi({
  label,
  value,
  detail,
  to,
  tone,
}: {
  label: string;
  value: string;
  detail?: string | undefined;
  to?: string;
  tone?: 'danger';
}) {
  const body = (
    <>
      <span className="text-xs text-fg-secondary">{label}</span>
      <span
        className={`text-xl font-semibold tabular-nums ${tone === 'danger' ? 'text-danger' : 'text-fg'}`}
      >
        {value}
      </span>
      {detail ? <span className="text-xs text-fg-muted">{detail}</span> : null}
    </>
  );
  const cls = 'flex flex-col gap-1 rounded-lg border border-border bg-surface p-4';
  return to ? (
    <Link to={to} className={`${cls} hover:border-border-strong`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function DashboardPage() {
  useDocumentTitle(t.title);
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = parseDashboardParams(searchParams);
  const { filters } = params;
  const branches = useBranchOptions();

  const overview = useSection('overview', filters, dashboardApi.overview);
  const sales = useSection('sales', filters, dashboardApi.sales);
  const inventory = useSection('inventory', filters, dashboardApi.inventory);
  const financial = useSection('financial', filters, dashboardApi.financial);
  const tables = useSection('tables', filters, dashboardApi.tables);

  // Preset periods are computed from the period name; only a custom range stores dates.
  // Switching to "custom" starts from the dates currently shown.
  const setParams = (period: Period, patch: DashboardFilters = {}) => {
    setSearchParams(toSearchParams({ period, filters: { ...filters, ...patch } }));
  };

  const canVehicles = can('vehicles.view');
  const canContracts = can('sales-contracts.view');

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-fg">{t.title}</h1>
      </header>

      <fieldset className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
        <legend className="sr-only">{t.filters.label}</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label={t.filters.period}
            options={PERIODS.map((p) => ({ value: p, label: t.filters.periods[p] }))}
            value={params.period}
            onChange={(event) => {
              setParams(event.target.value as Period);
            }}
          />
          {params.period === 'custom' ? (
            <>
              <TextField
                label={t.filters.from}
                type="date"
                value={filters.date_from ?? ''}
                onChange={(event) => {
                  setParams('custom', { date_from: event.target.value || undefined });
                }}
              />
              <TextField
                label={t.filters.to}
                type="date"
                value={filters.date_to ?? ''}
                onChange={(event) => {
                  setParams('custom', { date_to: event.target.value || undefined });
                }}
              />
            </>
          ) : null}
          {branches.options.length > 1 ? (
            <Select
              label={t.filters.branch}
              placeholder={t.filters.allBranches}
              options={branches.options}
              value={filters.branch_id ? String(filters.branch_id) : ''}
              onChange={(event) => {
                const v = event.target.value;
                setParams(params.period, { branch_id: v ? Number(v) : undefined });
              }}
            />
          ) : null}
        </div>
        <p className="text-xs text-fg-muted">{t.filters.note}</p>
      </fieldset>

      {/* Headline numbers */}
      <SectionBody query={overview}>
        {(o) => {
          const k = t.kpis;
          return (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <Kpi
                  label={k.sales}
                  value={formatMoney(toMoney(o.sales.total_sales))}
                  detail={interpolate(k.contracts, {
                    count: formatNumber(toCount(o.sales.contracts)),
                  })}
                  {...(canContracts ? { to: '/sales-contracts' } : {})}
                />
                <Kpi
                  label={k.collections}
                  value={formatMoney(toMoney(o.total_collections))}
                  detail={k.collectionsHint}
                />
                <Kpi
                  label={k.outstanding}
                  value={formatMoney(toMoney(o.outstanding_customer_balances))}
                  detail={k.outstandingHint}
                />
                <Kpi
                  label={k.overdue}
                  value={formatMoney(toMoney(o.overdue_installments.amount))}
                  detail={interpolate(k.overdueCount, {
                    count: formatNumber(toCount(o.overdue_installments.count)),
                  })}
                  {...(toCount(o.overdue_installments.count) > 0
                    ? { tone: 'danger' as const }
                    : {})}
                />
                <Kpi
                  label={k.customers}
                  value={formatNumber(toCount(o.active_customers))}
                  {...(can('customers.view') ? { to: '/customers' } : {})}
                />
                <Kpi
                  label={k.expenses}
                  value={formatMoney(toMoney(o.expenses.total_paid))}
                  detail={interpolate(k.pendingApprovals, {
                    count: formatNumber(toCount(o.expenses.pending_approvals)),
                  })}
                />
              </div>

              <Card title={t.vehicles.title}>
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                  {(
                    [
                      ['total', ''],
                      ['available', 'available'],
                      ['reserved', 'reserved'],
                      ['under_maintenance', 'under_maintenance'],
                      ['in_transit', 'transferred'],
                      ['sold', 'sold'],
                    ] as const
                  ).map(([key, status]) => {
                    const content = (
                      <>
                        <span className="text-2xl font-semibold text-fg tabular-nums">
                          {formatNumber(toCount(o.vehicles[key]))}
                        </span>
                        <span className="text-xs text-fg-secondary">{t.vehicles[key]}</span>
                      </>
                    );
                    const cls = 'flex flex-col gap-0.5 rounded-md bg-surface-muted p-3';
                    return (
                      <li key={key}>
                        {canVehicles ? (
                          <Link
                            to={status ? `/vehicles?status=${status}` : '/vehicles'}
                            className={`${cls} hover:bg-canvas`}
                          >
                            {content}
                          </Link>
                        ) : (
                          <div className={cls}>{content}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </>
          );
        }}
      </SectionBody>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title={t.charts.monthlySales}>
          <p className="-mt-3 mb-3 text-xs text-fg-muted">{t.charts.monthlySalesHint}</p>
          <SectionBody query={sales}>
            {(s) => (
              <MonthlyColumns
                label={t.charts.monthlySales}
                points={s.monthly.map((m) => ({
                  month: m.month,
                  total: toMoney(m.total),
                  count: toCount(m.contracts),
                }))}
              />
            )}
          </SectionBody>
        </Card>
        <Card title={t.charts.byPaymentType}>
          <SectionBody query={sales}>
            {(s) => (
              <RankedBars
                items={s.by_payment_type
                  .map((p) => ({
                    key: p.payment_type,
                    label: labelOf(paymentTypeLabels, p.payment_type),
                    value: toMoney(p.total),
                    detail: interpolate(t.kpis.contracts, { count: toCount(p.contracts) }),
                  }))
                  .sort((a, b) => Number(b.value) - Number(a.value))}
              />
            )}
          </SectionBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card title={t.charts.byBrand}>
          <SectionBody query={sales}>
            {(s) => (
              <RankedBars
                items={s.by_brand.slice(0, 8).map((b) => ({
                  key: String(b.id),
                  label: b.name,
                  value: toMoney(b.total),
                  detail: interpolate(t.kpis.contracts, { count: toCount(b.contracts) }),
                }))}
              />
            )}
          </SectionBody>
        </Card>
        <Card title={t.charts.byBranch}>
          <SectionBody query={sales}>
            {(s) => (
              <RankedBars
                items={s.by_branch.map((b) => ({
                  key: String(b.id),
                  label: b.name,
                  value: toMoney(b.total),
                  detail: interpolate(t.kpis.contracts, { count: toCount(b.contracts) }),
                }))}
              />
            )}
          </SectionBody>
        </Card>
        <Card title={t.charts.stockByBrand}>
          <p className="-mt-3 mb-3 text-xs text-fg-muted">{t.charts.stockByBrandHint}</p>
          <SectionBody query={inventory}>
            {(inv) => (
              <RankedBars
                format="count"
                items={inv.by_brand.slice(0, 8).map((b) => ({
                  key: b.name,
                  label: b.name,
                  value: toCount(b.in_stock),
                }))}
              />
            )}
          </SectionBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title={t.charts.cashflow}>
          <p className="-mt-3 mb-3 text-xs text-fg-muted">{t.charts.cashflowHint}</p>
          <SectionBody query={financial}>
            {(fin) =>
              fin.monthly_receipts_vs_payments.length === 0 ? (
                <p className="text-sm text-fg-muted">{t.charts.empty}</p>
              ) : (
                // Two measures per month: a table reads more precisely than paired bars here.
                <div className="max-h-80 overflow-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">{t.charts.cashflow}</caption>
                    <thead className="sticky top-0 bg-surface-muted text-xs text-fg-secondary">
                      <tr>
                        <th scope="col" className={th}>
                          {t.charts.month}
                        </th>
                        <th scope="col" className={`${th} text-end`}>
                          {t.charts.receipts}
                        </th>
                        <th scope="col" className={`${th} text-end`}>
                          {t.charts.payments}
                        </th>
                        <th scope="col" className={`${th} text-end`}>
                          {t.charts.net}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {[...fin.monthly_receipts_vs_payments].reverse().map((row) => {
                        const net = subtractMoney(toMoney(row.receipts), toMoney(row.payments));
                        return (
                          <tr key={row.month}>
                            <th scope="row" className={`${td} text-start font-normal`}>
                              {monthLabel(row.month)}
                            </th>
                            <td className={`${td} text-end tabular-nums`}>
                              {formatMoney(toMoney(row.receipts), { withCurrency: false })}
                            </td>
                            <td className={`${td} text-end tabular-nums`}>
                              {formatMoney(toMoney(row.payments), { withCurrency: false })}
                            </td>
                            <td
                              className={`${td} text-end font-medium tabular-nums ${
                                net.startsWith('-') ? 'text-danger' : 'text-fg'
                              }`}
                            >
                              {formatMoney(net, { withCurrency: false })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            }
          </SectionBody>
        </Card>
        <Card title={t.charts.installments}>
          <SectionBody query={financial}>
            {(fin) => {
              const ic = fin.installment_collection;
              const due = toMoney(ic?.due_total);
              const collected = toMoney(ic?.collected_total);
              const ratio = Number(due) > 0 ? Math.min(Number(collected) / Number(due), 1) : 0;
              if (toCount(ic?.total_count) === 0) {
                return <p className="text-sm text-fg-muted">{t.charts.empty}</p>;
              }
              return (
                <div className="flex flex-col gap-3">
                  <p className="text-3xl font-semibold text-fg tabular-nums">
                    {formatNumber(Math.round(ratio * 100))}%
                  </p>
                  <div
                    role="meter"
                    aria-label={t.charts.installments}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(ratio * 100)}
                    className="h-2 rounded-full bg-surface-muted"
                  >
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${String(ratio * 100)}%` }}
                    />
                  </div>
                  <p className="text-sm text-fg-secondary">
                    {interpolate(t.charts.installmentsBody, {
                      collected: formatMoney(collected),
                      due: formatMoney(due),
                    })}
                  </p>
                  <p className="text-xs text-fg-muted">
                    {interpolate(t.charts.installmentsPaid, {
                      paid: formatNumber(toCount(ic?.paid_count)),
                      total: formatNumber(toCount(ic?.total_count)),
                    })}
                  </p>
                </div>
              );
            }}
          </SectionBody>
        </Card>
      </div>

      <p className="text-xs text-fg-muted">{t.tables.tablesNote}</p>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Card title={t.tables.recentSales}>
          <SectionBody query={tables}>
            {(tb) =>
              tb.recent_sales.length === 0 ? (
                <p className="text-sm text-fg-muted">{t.tables.empty}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[30rem] text-sm">
                    <caption className="sr-only">{t.tables.recentSales}</caption>
                    <thead className="bg-surface-muted text-xs text-fg-secondary">
                      <tr>
                        <th scope="col" className={th}>
                          {t.tables.number}
                        </th>
                        <th scope="col" className={th}>
                          {t.tables.customer}
                        </th>
                        <th scope="col" className={th}>
                          {t.tables.date}
                        </th>
                        <th scope="col" className={`${th} text-end`}>
                          {t.tables.amount}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {tb.recent_sales.map((row) => (
                        <tr key={row.id}>
                          <td className={td} dir="ltr">
                            {canContracts ? (
                              <Link
                                to={`/sales-contracts/${String(row.id)}`}
                                className="text-accent hover:underline"
                              >
                                {row.number}
                              </Link>
                            ) : (
                              row.number
                            )}
                          </td>
                          <td className={td}>
                            {row.customer}
                            {row.status === 'cancelled' ? (
                              <span className="ms-2">
                                <Badge>{labelOf(contractStatusLabels, row.status)}</Badge>
                              </span>
                            ) : null}
                          </td>
                          <td className={td}>{formatDate(row.contract_date)}</td>
                          <td className={`${td} text-end tabular-nums`}>
                            {formatMoney(toMoney(row.final_amount), { withCurrency: false })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </SectionBody>
        </Card>
        <Card title={t.tables.transactions}>
          <SectionBody query={tables}>
            {(tb) =>
              tb.recent_transactions.length === 0 ? (
                <p className="text-sm text-fg-muted">{t.tables.empty}</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[30rem] text-sm">
                    <caption className="sr-only">{t.tables.transactions}</caption>
                    <thead className="bg-surface-muted text-xs text-fg-secondary">
                      <tr>
                        <th scope="col" className={th}>
                          {t.tables.category}
                        </th>
                        <th scope="col" className={th}>
                          {t.tables.party}
                        </th>
                        <th scope="col" className={th}>
                          {t.tables.date}
                        </th>
                        <th scope="col" className={`${th} text-end`}>
                          {t.tables.amount}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {tb.recent_transactions.map((row) => (
                        <tr key={row.id}>
                          <td className={td}>
                            {labelOf(transactionCategoryLabels, row.category)}
                            {row.status === 'reversed' ? (
                              <span className="ms-2">
                                <Badge tone="warning">{ar.customers.detail.reversed}</Badge>
                              </span>
                            ) : null}
                          </td>
                          <td className={td}>{row.party_name ?? ar.common.notAvailable}</td>
                          <td className={td}>{formatDate(row.transaction_date)}</td>
                          <td className={`${td} text-end font-medium tabular-nums`}>
                            {row.type === 'payment' ? '−' : '+'}
                            {formatMoney(toMoney(row.amount), { withCurrency: false })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </SectionBody>
        </Card>
        <InstallmentsCard
          title={t.tables.overdue}
          query={tables}
          pick={(tb) => tb.overdue_payments}
          canContracts={canContracts}
          overdue
        />
        <InstallmentsCard
          title={t.tables.upcoming}
          query={tables}
          pick={(tb) => tb.upcoming_installments}
          canContracts={canContracts}
        />
      </div>
    </section>
  );
}

function InstallmentsCard<T>({
  title,
  query,
  pick,
  canContracts,
  overdue = false,
}: {
  title: string;
  query: UseQueryResult<T>;
  pick: (data: T) => InstallmentRow[];
  canContracts: boolean;
  overdue?: boolean;
}) {
  return (
    <Card title={title}>
      <SectionBody query={query}>
        {(data) => {
          const rows = pick(data);
          if (rows.length === 0) return <p className="text-sm text-fg-muted">{t.tables.empty}</p>;
          const total = addMoney(...rows.map((r) => toMoney(r.remaining_amount)));
          return (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[28rem] text-sm">
                <caption className="sr-only">{title}</caption>
                <thead className="bg-surface-muted text-xs text-fg-secondary">
                  <tr>
                    <th scope="col" className={th}>
                      {t.tables.customer}
                    </th>
                    <th scope="col" className={th}>
                      {t.tables.installment}
                    </th>
                    <th scope="col" className={th}>
                      {t.tables.dueDate}
                    </th>
                    <th scope="col" className={`${th} text-end`}>
                      {t.tables.remaining}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className={td}>
                        {canContracts ? (
                          <Link
                            to={`/sales-contracts/${String(row.sales_contract_id)}`}
                            className="text-accent hover:underline"
                          >
                            {row.customer}
                          </Link>
                        ) : (
                          row.customer
                        )}
                      </td>
                      <td className={`${td} tabular-nums`}>#{toCount(row.installment_number)}</td>
                      <td className={`${td} ${overdue ? 'text-danger' : ''}`}>
                        {formatDate(row.due_date)}
                      </td>
                      <td className={`${td} text-end tabular-nums`}>
                        {formatMoney(toMoney(row.remaining_amount), { withCurrency: false })}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border-strong">
                    <td colSpan={3} className={`${td} text-fg-secondary`}>
                      {t.tables.remaining}
                    </td>
                    <td className={`${td} text-end font-semibold tabular-nums`}>
                      {formatMoney(total, { withCurrency: false })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        }}
      </SectionBody>
    </Card>
  );
}
