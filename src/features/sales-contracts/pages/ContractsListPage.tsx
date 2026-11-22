import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router';
import { Pagination } from '@/components/shared/Pagination';
import { SearchInput } from '@/components/shared/SearchInput';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { TextField } from '@/components/ui/TextField';
import { useAuth } from '@/features/auth/auth-context';
import { useBranchOptions } from '@/features/branches/use-branch-options';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getErrorMessage } from '@/lib/api/error-message';
import { formatDate, formatNumber } from '@/lib/format';
import { formatMoney } from '@/lib/money/money';
import { ar, interpolate } from '@/locales/ar';
import { contractKeys, salesContractsApi } from '../api/sales-contracts-api';
import { contractStatusLabels, contractStatusTone, paymentTypeLabels } from '../labels';
import {
  CONTRACT_SORTS,
  hasActiveFilters,
  PAGE_SIZES,
  parseContractListParams,
  toSearchParams,
  type ContractFilters,
  type ContractListParams,
} from '../list-params';
import { CONTRACT_STATUSES, PAYMENT_TYPES, type SalesContract } from '../types';
import type { ContractDetailLinkState } from './ContractDetailPage';

const t = ar.salesContracts;
const NA = ar.common.notAvailable;
const th = 'px-4 py-3 text-start font-medium';
const money = (value: string) => formatMoney(value, { withCurrency: false });

export function ContractsListPage() {
  useDocumentTitle(t.title);
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = parseContractListParams(searchParams);
  const branches = useBranchOptions();

  const update = useCallback(
    (
      patch: Partial<Omit<ContractListParams, 'filter'>> & { filter?: Partial<ContractFilters> },
    ) => {
      setSearchParams((current) => {
        const base = parseContractListParams(current);
        const filter = Object.fromEntries(
          Object.entries<string | number | undefined>({ ...base.filter, ...patch.filter }).filter(
            ([, value]) => value !== undefined,
          ),
        ) as ContractFilters;
        return toSearchParams({ ...base, ...patch, filter, page: patch.page ?? 1 });
      });
    },
    [setSearchParams],
  );

  const commitSearch = useCallback(
    (value: string) => {
      update({ search: value || undefined });
    },
    [update],
  );

  const query = useQuery({
    queryKey: contractKeys.list(params),
    queryFn: ({ signal }) => salesContractsApi.list(params, signal),
    placeholderData: keepPreviousData,
  });
  const data = query.data;
  const filtered = hasActiveFilters(params);

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-fg">{t.title}</h1>
          {data ? (
            <p className="mt-1 text-sm text-fg-muted">
              {interpolate(t.count, { count: formatNumber(data.pagination.total) })}
            </p>
          ) : null}
        </div>
        {can('sales-contracts.create') ? (
          <Link
            to="/sales-contracts/new"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-hover"
          >
            + {t.form.create}
          </Link>
        ) : null}
      </header>

      <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_14rem]">
          <SearchInput
            key={params.search ?? ''}
            label={ar.list.search}
            placeholder={t.searchPlaceholder}
            initialValue={params.search ?? ''}
            onCommit={commitSearch}
          />
          <Select
            label={ar.list.sort}
            options={CONTRACT_SORTS.map((sort) => ({ value: sort, label: t.sorts[sort] }))}
            value={params.sort}
            onChange={(event) => {
              update({ sort: event.target.value as ContractListParams['sort'] });
            }}
          />
        </div>
        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <legend className="sr-only">{t.filters.label}</legend>
          <Select
            label={t.filters.status}
            placeholder={ar.common.all}
            options={CONTRACT_STATUSES.map((s) => ({ value: s, label: contractStatusLabels[s] }))}
            value={params.filter.status ?? ''}
            onChange={(event) => {
              update({ filter: { status: event.target.value || undefined } });
            }}
          />
          <Select
            label={t.filters.paymentType}
            placeholder={ar.common.all}
            options={PAYMENT_TYPES.map((p) => ({ value: p, label: paymentTypeLabels[p] }))}
            value={params.filter.payment_type ?? ''}
            onChange={(event) => {
              update({ filter: { payment_type: event.target.value || undefined } });
            }}
          />
          {branches.options.length > 1 ? (
            <Select
              label={t.filters.branch}
              placeholder={ar.common.all}
              options={branches.options}
              value={params.filter.branch_id === undefined ? '' : String(params.filter.branch_id)}
              onChange={(event) => {
                const value = event.target.value;
                update({ filter: { branch_id: value === '' ? undefined : Number(value) } });
              }}
            />
          ) : null}
          <TextField
            label={t.filters.dateFrom}
            type="date"
            value={params.date_from ?? ''}
            onChange={(event) => {
              update({ date_from: event.target.value || undefined });
            }}
          />
          <TextField
            label={t.filters.dateTo}
            type="date"
            value={params.date_to ?? ''}
            onChange={(event) => {
              update({ date_to: event.target.value || undefined });
            }}
          />
        </fieldset>
        {filtered ? (
          <div>
            <Button
              variant="ghost"
              onClick={() => {
                setSearchParams(new URLSearchParams());
              }}
            >
              {ar.list.clearFilters}
            </Button>
          </div>
        ) : null}
      </div>

      {query.isError && !data ? (
        <Alert tone="danger">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {ar.list.loadError} {getErrorMessage(query.error)}
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
      ) : null}

      {query.isPending ? (
        <p role="status" className="py-12 text-center text-fg-muted">
          {ar.common.loading}
        </p>
      ) : null}

      {data && data.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-strong bg-surface p-10 text-center">
          <h2 className="font-semibold text-fg">{filtered ? t.emptyTitle : t.emptyAllTitle}</h2>
          <p className="mt-1 text-sm text-fg-muted">{filtered ? t.emptyBody : t.emptyAllBody}</p>
        </div>
      ) : null}

      {data && data.items.length > 0 ? (
        <>
          <ContractsTable contracts={data.items} busy={query.isFetching} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Pagination
              meta={data.pagination}
              onPageChange={(page) => {
                update({ page });
              }}
            />
            <div className="w-36">
              <Select
                label={ar.list.perPage}
                options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))}
                value={String(params.per_page)}
                onChange={(event) => {
                  update({ per_page: Number(event.target.value) });
                }}
              />
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

function ContractsTable({ contracts, busy }: { contracts: SalesContract[]; busy: boolean }) {
  const location = useLocation();
  const linkState: ContractDetailLinkState = { listSearch: location.search };
  const c = t.columns;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table aria-busy={busy} className="w-full min-w-[58rem] text-sm">
        <caption className="sr-only">{t.title}</caption>
        <thead className="bg-surface-muted text-xs text-fg-secondary">
          <tr>
            <th scope="col" className={th}>
              {c.number}
            </th>
            <th scope="col" className={th}>
              {c.customer}
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
              {c.outstanding}
            </th>
            <th scope="col" className={th}>
              {c.status}
            </th>
          </tr>
        </thead>
        <tbody className={`divide-y divide-border ${busy ? 'opacity-60' : ''}`}>
          {contracts.map((contract) => (
            <tr key={contract.id} className="hover:bg-canvas">
              <td className="px-4 py-3 whitespace-nowrap">
                <Link
                  to={`/sales-contracts/${String(contract.id)}`}
                  state={linkState}
                  dir="ltr"
                  className="inline-block font-medium text-fg hover:text-accent hover:underline"
                >
                  {contract.number}
                </Link>
              </td>
              <td className="px-4 py-3">
                {contract.customer?.name ?? NA}
                {contract.customer ? (
                  <div className="text-xs text-fg-muted" dir="ltr">
                    <span className="inline-block">{contract.customer.phone}</span>
                  </div>
                ) : null}
              </td>
              <td className="px-4 py-3">
                {contract.vehicle
                  ? [contract.vehicle.brand, contract.vehicle.model, contract.vehicle.year]
                      .filter(Boolean)
                      .join(' ')
                  : NA}
                {contract.vehicle ? (
                  <div className="text-xs text-fg-muted" dir="ltr">
                    <span className="inline-block">{contract.vehicle.stock_number}</span>
                  </div>
                ) : null}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">{formatDate(contract.contract_date)}</td>
              <td className="px-4 py-3 whitespace-nowrap">
                {paymentTypeLabels[contract.payment_type]}
              </td>
              <td className="px-4 py-3 text-end whitespace-nowrap tabular-nums">
                {money(contract.final_amount)}
              </td>
              <td className="px-4 py-3 text-end font-medium whitespace-nowrap tabular-nums">
                {money(contract.outstanding_amount)}
              </td>
              <td className="px-4 py-3">
                <Badge tone={contractStatusTone[contract.status]}>
                  {contractStatusLabels[contract.status]}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
