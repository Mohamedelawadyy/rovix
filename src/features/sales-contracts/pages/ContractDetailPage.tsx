import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { ForbiddenPage, NotFoundPage } from '@/app/pages/StatusPages';
import { Card, DetailList, type DetailItem } from '@/components/shared/DetailList';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/auth-context';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { isApiError } from '@/lib/api';
import { getErrorMessage } from '@/lib/api/error-message';
import { formatDate, formatDateTime } from '@/lib/format';
import { compareMoney, formatMoney } from '@/lib/money/money';
import { parseRouteId } from '@/lib/route-id';
import { ar, interpolate } from '@/locales/ar';
import { contractKeys, salesContractsApi } from '../api/sales-contracts-api';
import { CancelContractDialog, RecordPaymentDialog } from '../components/ContractDialogs';
import {
  contractStatusLabels,
  contractStatusTone,
  financingStatusLabels,
  frequencyLabels,
  installmentStatusLabels,
  installmentStatusTone,
  labelOf,
  paymentMethodLabels,
  paymentTypeLabels,
  transactionCategoryLabels,
} from '../labels';
import { isFinancingSummary, isInstallmentPlan, type SalesContract } from '../types';

const t = ar.salesContracts.detail;
const NA = ar.common.notAvailable;
const money = (v: string | null | undefined) => (v ? formatMoney(v) : NA);
const th = 'px-3 py-2.5 text-start font-medium whitespace-nowrap';
const td = 'px-3 py-2.5 whitespace-nowrap';
const linkClass = 'text-accent hover:underline';

export interface ContractDetailLinkState {
  listSearch?: string;
  notice?: string;
}

export function ContractDetailPage() {
  const id = parseRouteId(useParams().contractId);
  if (id === null) return <NotFoundPage />;
  return <ContractDetail id={id} />;
}

function vehicleName(v: NonNullable<SalesContract['vehicle']>): string {
  return [v.brand, v.model, v.year].filter(Boolean).join(' ');
}

function ContractDetail({ id }: { id: number }) {
  const { can } = useAuth();
  const location = useLocation();
  const linkState = location.state as ContractDetailLinkState | null;
  const [notice, setNotice] = useState<string | null>(linkState?.notice ?? null);
  const [dialog, setDialog] = useState<'payment' | 'cancel' | null>(null);

  const query = useQuery({
    queryKey: contractKeys.detail(id),
    queryFn: ({ signal }) => salesContractsApi.get(id, signal),
  });
  const payments = useQuery({
    queryKey: contractKeys.payments(id),
    queryFn: ({ signal }) => salesContractsApi.payments(id, signal),
    enabled: query.isSuccess,
  });
  const contract = query.data;
  useDocumentTitle(contract ? contract.number : ar.salesContracts.title);

  const error = query.error;
  if (isApiError(error) && error.kind === 'not_found') return <NotFoundPage />;
  if (isApiError(error) && error.kind === 'forbidden') return <ForbiddenPage />;

  const backLink = (
    <Link
      to={`/sales-contracts${linkState?.listSearch ?? ''}`}
      className="text-sm text-accent hover:underline"
    >
      → {t.back}
    </Link>
  );

  if (!contract) {
    return (
      <section className="flex flex-col gap-4">
        {backLink}
        {query.isError ? (
          <Alert tone="danger">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>
                {ar.list.loadError} {getErrorMessage(error)}
              </span>
              <Button
                variant="secondary"
                onClick={() => {
                  void query.refetch();
                }}
              >
                {ar.common.retry}
              </Button>
            </div>
          </Alert>
        ) : (
          <p role="status" className="py-12 text-center text-fg-muted">
            {ar.common.loading}
          </p>
        )}
      </section>
    );
  }

  const f = t.fields;
  const { customer, vehicle } = contract;
  const parties: DetailItem[] = [
    {
      label: f.customer,
      value: customer ? (
        <Link to={`/customers/${String(customer.id)}`} className={linkClass}>
          {customer.name}
        </Link>
      ) : (
        NA
      ),
    },
    {
      label: f.vehicle,
      value: vehicle ? (
        <span className="flex flex-col gap-0.5">
          <Link to={`/vehicles/${String(vehicle.id)}`} className={linkClass}>
            {vehicleName(vehicle)}
          </Link>
          <span dir="ltr" className="self-start text-xs text-fg-muted">
            <span className="inline-block">{vehicle.stock_number}</span>
          </span>
        </span>
      ) : (
        NA
      ),
    },
    { label: f.branch, value: contract.branch?.name ?? NA },
    { label: f.employee, value: contract.sales_employee?.name ?? NA },
    { label: f.date, value: formatDate(contract.contract_date) },
    { label: f.paymentType, value: paymentTypeLabels[contract.payment_type] },
    ...(contract.status === 'cancelled'
      ? [
          { label: f.cancelledAt, value: formatDateTime(contract.cancelled_at) },
          { label: f.cancellationReason, value: contract.cancellation_reason ?? NA },
        ]
      : []),
  ];
  const amounts: DetailItem[] = [
    { label: f.sellingPrice, value: money(contract.selling_price) },
    { label: f.discount, value: money(contract.discount) },
    { label: f.finalAmount, value: money(contract.final_amount) },
    ...(contract.payment_type !== 'cash'
      ? [{ label: f.downPayment, value: money(contract.down_payment) }]
      : []),
    { label: f.paid, value: money(contract.paid_amount) },
    {
      label: f.outstanding,
      value: <span className="text-lg font-semibold">{money(contract.outstanding_amount)}</span>,
    },
  ];

  const plan = contract.payment_plan;
  const isOpen = contract.status !== 'cancelled';
  const hasOutstanding = compareMoney(contract.outstanding_amount, 0) > 0;
  const canPay =
    isOpen && hasOutstanding && contract.payment_type !== 'installment' && can('treasury.create');
  const canCancel = isOpen && can('sales-contracts.cancel');

  return (
    <article className="flex flex-col gap-5">
      {backLink}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-fg" dir="ltr">
            <span className="inline-block">{contract.number}</span>
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            {[customer?.name, vehicle ? vehicleName(vehicle) : null].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={contractStatusTone[contract.status]}>
            {contractStatusLabels[contract.status]}
          </Badge>
          {canPay ? (
            <Button
              variant="primary"
              onClick={() => {
                setDialog('payment');
              }}
            >
              {ar.salesContracts.payment.open}
            </Button>
          ) : null}
          {canCancel ? (
            <Button
              variant="danger"
              onClick={() => {
                setDialog('cancel');
              }}
            >
              {ar.salesContracts.cancel.open}
            </Button>
          ) : null}
        </div>
      </header>

      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {contract.reservation_id !== null ? <Alert tone="info">{t.fromReservation}</Alert> : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title={t.sections.parties}>
          <DetailList items={parties} />
        </Card>
        <Card title={t.sections.amounts}>
          <DetailList items={amounts} />
        </Card>
      </div>

      {isInstallmentPlan(plan) ? (
        <Card title={t.sections.installments}>
          <p className="mb-3 text-sm text-fg-secondary">
            {[
              plan.installment_frequency
                ? labelOf(frequencyLabels, plan.installment_frequency)
                : null,
              plan.start_date ? `${f.startDate}: ${formatDate(plan.start_date)}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <caption className="sr-only">{t.sections.installments}</caption>
              <thead className="bg-surface-muted text-xs text-fg-secondary">
                <tr>
                  <th scope="col" className={th}>
                    {t.installmentColumns.number}
                  </th>
                  <th scope="col" className={th}>
                    {t.installmentColumns.dueDate}
                  </th>
                  <th scope="col" className={`${th} text-end`}>
                    {t.installmentColumns.amount}
                  </th>
                  <th scope="col" className={`${th} text-end`}>
                    {t.installmentColumns.paid}
                  </th>
                  <th scope="col" className={`${th} text-end`}>
                    {t.installmentColumns.remaining}
                  </th>
                  <th scope="col" className={th}>
                    {t.installmentColumns.status}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {plan.installments.map((row) => (
                  <tr key={row.id}>
                    <td className={`${td} tabular-nums`}>{row.installment_number}</td>
                    <td className={td}>{formatDate(row.due_date)}</td>
                    <td className={`${td} text-end tabular-nums`}>{money(row.amount)}</td>
                    <td className={`${td} text-end tabular-nums`}>{money(row.paid_amount)}</td>
                    <td className={`${td} text-end tabular-nums`}>{money(row.remaining_amount)}</td>
                    <td className={td}>
                      <Badge tone={installmentStatusTone[row.status]}>
                        {installmentStatusLabels[row.status]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-fg-muted">{t.installmentsHint}</p>
        </Card>
      ) : null}

      {isFinancingSummary(plan) ? (
        <Card title={t.sections.financing}>
          <DetailList
            items={[
              { label: f.bank, value: plan.bank?.name ?? NA },
              { label: f.applicationNumber, value: plan.number, ltr: true },
              { label: f.reference, value: plan.transaction_reference ?? NA, ltr: true },
              { label: f.applicationDate, value: formatDate(plan.application_date) },
              {
                label: f.financingStatus,
                value: financingStatusLabels[plan.status] ?? plan.status,
              },
              { label: f.expected, value: money(plan.expected_amount) },
              { label: f.approved, value: money(plan.approved_amount) },
              { label: f.received, value: money(plan.received_amount) },
              { label: f.remaining, value: money(plan.remaining_amount) },
            ]}
          />
        </Card>
      ) : null}

      <Card title={t.sections.payments}>
        {payments.isPending ? (
          <p role="status" className="text-sm text-fg-muted">
            {ar.common.loading}
          </p>
        ) : payments.isError ? (
          <Alert tone="danger">
            {ar.customers.detail.sectionError} {getErrorMessage(payments.error)}
          </Alert>
        ) : payments.data.transactions.length === 0 ? (
          <p className="text-sm text-fg-muted">{t.emptyPayments}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <caption className="sr-only">{t.sections.payments}</caption>
              <thead className="bg-surface-muted text-xs text-fg-secondary">
                <tr>
                  <th scope="col" className={th}>
                    {ar.customers.detail.paymentColumns.number}
                  </th>
                  <th scope="col" className={th}>
                    {ar.customers.detail.paymentColumns.date}
                  </th>
                  <th scope="col" className={th}>
                    {ar.customers.detail.paymentColumns.category}
                  </th>
                  <th scope="col" className={th}>
                    {ar.customers.detail.paymentColumns.method}
                  </th>
                  <th scope="col" className={`${th} text-end`}>
                    {ar.customers.detail.paymentColumns.amount}
                  </th>
                  <th scope="col" className={th}>
                    {ar.customers.detail.paymentColumns.status}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payments.data.transactions.map((p) => (
                  <tr key={p.id}>
                    <td className={`${td} font-medium`} dir="ltr">
                      {p.number}
                    </td>
                    <td className={td}>{formatDate(p.transaction_date)}</td>
                    <td className={td}>{labelOf(transactionCategoryLabels, p.category)}</td>
                    <td className={td}>{labelOf(paymentMethodLabels, p.payment_method)}</td>
                    <td className={`${td} text-end font-medium tabular-nums`}>
                      {p.type === 'payment' ? '−' : ''}
                      {formatMoney(p.amount, { withCurrency: false })}
                    </td>
                    <td className={td}>
                      <Badge tone={p.status === 'reversed' ? 'warning' : 'success'}>
                        {p.status === 'reversed'
                          ? ar.customers.detail.reversed
                          : ar.customers.detail.posted}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {contract.status_history && contract.status_history.length > 0 ? (
        <Card title={t.sections.history}>
          <ol className="flex flex-col gap-3">
            {contract.status_history.map((h, index) => (
              <li key={`${h.created_at ?? ''}-${String(index)}`} className="text-sm">
                <div className="font-medium text-fg">
                  {h.from_status === null
                    ? t.created
                    : interpolate(t.history, {
                        from: labelOf(contractStatusLabels, h.from_status),
                        to: labelOf(contractStatusLabels, h.to_status),
                      })}
                </div>
                <div className="text-xs text-fg-muted">
                  {formatDateTime(h.created_at)}
                  {h.reason && h.from_status !== null ? ` · ${h.reason}` : ''}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}

      {contract.notes ? (
        <Card title={t.sections.notes}>
          <p className="text-sm whitespace-pre-line text-fg">{contract.notes}</p>
        </Card>
      ) : null}

      {dialog === 'payment' ? (
        <RecordPaymentDialog
          contract={contract}
          onClose={() => {
            setDialog(null);
          }}
          onDone={(message) => {
            setDialog(null);
            setNotice(message);
          }}
        />
      ) : null}
      {dialog === 'cancel' ? (
        <CancelContractDialog
          contract={contract}
          onClose={() => {
            setDialog(null);
          }}
          onDone={(message) => {
            setDialog(null);
            setNotice(message);
          }}
        />
      ) : null}
    </article>
  );
}
