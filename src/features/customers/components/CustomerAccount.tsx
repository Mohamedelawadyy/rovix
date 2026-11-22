import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Card, DetailList } from '@/components/shared/DetailList';
import { Pagination } from '@/components/shared/Pagination';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/features/auth/auth-context';
import { Link } from 'react-router';
import { getErrorMessage } from '@/lib/api/error-message';
import { formatDate, formatNumber } from '@/lib/format';
import { formatMoney } from '@/lib/money/money';
import { ar } from '@/locales/ar';
import { customerKeys, customersApi } from '../api/customers-api';
import {
  contractStatusLabels,
  contractStatusTone,
  labelOf,
  paymentMethodLabels,
  paymentTypeLabels,
  transactionCategoryLabels,
} from '../labels';

const t = ar.customers.detail;
const NA = ar.common.notAvailable;
const money = (value: string) => formatMoney(value, { withCurrency: false });

function SectionState({
  isPending,
  error,
  empty,
  emptyText,
}: {
  isPending: boolean;
  error: unknown;
  empty: boolean;
  emptyText: string;
}): ReactNode {
  if (isPending) {
    return (
      <p role="status" className="py-4 text-sm text-fg-muted">
        {ar.common.loading}
      </p>
    );
  }
  if (error) {
    return (
      <Alert tone="danger">
        {t.sectionError} {getErrorMessage(error)}
      </Alert>
    );
  }
  return empty ? <p className="text-sm text-fg-muted">{emptyText}</p> : null;
}

const th = 'px-3 py-2.5 text-start font-medium whitespace-nowrap';
const td = 'px-3 py-2.5 whitespace-nowrap';

/** Totals over non-cancelled contracts (GET /customers/{id}/balance). */
export function CustomerBalanceCard({ customerId }: { customerId: number }) {
  const query = useQuery({
    queryKey: customerKeys.balance(customerId),
    queryFn: ({ signal }) => customersApi.balance(customerId, signal),
  });
  const b = query.data;

  return (
    <Card title={t.sections.account}>
      {b ? (
        <>
          <DetailList
            items={[
              { label: t.balance.contracts, value: formatNumber(b.contracts_count) },
              { label: t.balance.total, value: formatMoney(b.total_contract_amount) },
              { label: t.balance.paid, value: formatMoney(b.total_paid) },
              {
                label: t.balance.outstanding,
                value: (
                  <span className="text-lg font-semibold">
                    {formatMoney(b.outstanding_balance)}
                  </span>
                ),
              },
            ]}
          />
          <p className="mt-3 text-xs text-fg-muted">{t.balance.hint}</p>
        </>
      ) : (
        <SectionState isPending={query.isPending} error={query.error} empty={false} emptyText="" />
      )}
    </Card>
  );
}

export function CustomerContractsCard({ customerId }: { customerId: number }) {
  const canOpenContracts = useAuth().can('sales-contracts.view');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: customerKeys.contracts(customerId, page),
    queryFn: ({ signal }) => customersApi.contracts(customerId, page, signal),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const c = t.contractColumns;

  return (
    <Card title={t.sections.contracts}>
      {data && data.items.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <table aria-busy={query.isFetching} className="w-full min-w-[52rem] text-sm">
              <caption className="sr-only">{t.sections.contracts}</caption>
              <thead className="bg-surface-muted text-xs text-fg-secondary">
                <tr>
                  <th scope="col" className={th}>
                    {c.number}
                  </th>
                  <th scope="col" className={th}>
                    {c.vehicle}
                  </th>
                  <th scope="col" className={th}>
                    {c.date}
                  </th>
                  <th scope="col" className={th}>
                    {c.paymentType}
                  </th>
                  <th scope="col" className={`${th} text-end`}>
                    {c.finalAmount}
                  </th>
                  <th scope="col" className={`${th} text-end`}>
                    {c.paid}
                  </th>
                  <th scope="col" className={`${th} text-end`}>
                    {c.outstanding}
                  </th>
                  <th scope="col" className={th}>
                    {c.status}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((contract) => (
                  <tr key={contract.id}>
                    <td className={`${td} font-medium`} dir="ltr">
                      {canOpenContracts ? (
                        <Link
                          to={`/sales-contracts/${String(contract.id)}`}
                          className="text-accent hover:underline"
                        >
                          {contract.number}
                        </Link>
                      ) : (
                        contract.number
                      )}
                    </td>
                    <td className={td}>
                      {contract.vehicle
                        ? [contract.vehicle.brand, contract.vehicle.model, contract.vehicle.year]
                            .filter(Boolean)
                            .join(' ')
                        : NA}
                    </td>
                    <td className={td}>{formatDate(contract.contract_date)}</td>
                    <td className={td}>{paymentTypeLabels[contract.payment_type]}</td>
                    <td className={`${td} text-end tabular-nums`}>
                      {money(contract.final_amount)}
                    </td>
                    <td className={`${td} text-end tabular-nums`}>{money(contract.paid_amount)}</td>
                    <td className={`${td} text-end font-medium tabular-nums`}>
                      {money(contract.outstanding_amount)}
                    </td>
                    <td className={td}>
                      <Badge tone={contractStatusTone[contract.status]}>
                        {contractStatusLabels[contract.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.pagination.last_page > 1 ? (
            <Pagination meta={data.pagination} onPageChange={setPage} />
          ) : null}
        </div>
      ) : (
        <SectionState
          isPending={query.isPending}
          error={query.error}
          empty={data?.items.length === 0}
          emptyText={t.emptyContracts}
        />
      )}
    </Card>
  );
}

export function CustomerPaymentsCard({ customerId }: { customerId: number }) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: customerKeys.payments(customerId, page),
    queryFn: ({ signal }) => customersApi.payments(customerId, page, signal),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const c = t.paymentColumns;

  return (
    <Card title={t.sections.payments}>
      {data && data.items.length > 0 ? (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <table aria-busy={query.isFetching} className="w-full min-w-[44rem] text-sm">
              <caption className="sr-only">{t.sections.payments}</caption>
              <thead className="bg-surface-muted text-xs text-fg-secondary">
                <tr>
                  <th scope="col" className={th}>
                    {c.number}
                  </th>
                  <th scope="col" className={th}>
                    {c.date}
                  </th>
                  <th scope="col" className={th}>
                    {c.category}
                  </th>
                  <th scope="col" className={th}>
                    {c.method}
                  </th>
                  <th scope="col" className={`${th} text-end`}>
                    {c.amount}
                  </th>
                  <th scope="col" className={th}>
                    {c.status}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((payment) => (
                  <tr key={payment.id}>
                    <td className={`${td} font-medium`} dir="ltr">
                      {payment.number}
                    </td>
                    <td className={td}>{formatDate(payment.transaction_date)}</td>
                    <td className={td}>
                      {labelOf(transactionCategoryLabels, payment.category)}{' '}
                      <span className="text-xs text-fg-muted">
                        ({payment.type === 'receipt' ? t.receipt : t.refund})
                      </span>
                    </td>
                    <td className={td}>{labelOf(paymentMethodLabels, payment.payment_method)}</td>
                    <td className={`${td} text-end font-medium tabular-nums`}>
                      {payment.type === 'payment' ? '−' : ''}
                      {money(payment.amount)}
                    </td>
                    <td className={td}>
                      <Badge tone={payment.status === 'reversed' ? 'warning' : 'success'}>
                        {payment.status === 'reversed' ? t.reversed : t.posted}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.pagination.last_page > 1 ? (
            <Pagination meta={data.pagination} onPageChange={setPage} />
          ) : null}
        </div>
      ) : (
        <SectionState
          isPending={query.isPending}
          error={query.error}
          empty={data?.items.length === 0}
          emptyText={t.emptyPayments}
        />
      )}
    </Card>
  );
}
