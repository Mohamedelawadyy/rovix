import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Pagination } from '@/components/shared/Pagination';
import { SearchInput } from '@/components/shared/SearchInput';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/features/auth/auth-context';
import { useBranchOptions } from '@/features/branches/use-branch-options';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getErrorMessage } from '@/lib/api/error-message';
import { formatNumber } from '@/lib/format';
import { ar, interpolate } from '@/locales/ar';
import { customerKeys, customersApi } from '../api/customers-api';
import { CustomerLookupDialog } from '../components/CustomerLookupDialog';
import { CustomersTable } from '../components/CustomersTable';
import { customerStatusLabels } from '../labels';
import {
  CUSTOMER_SORTS,
  hasActiveFilters,
  PAGE_SIZES,
  parseCustomerListParams,
  toSearchParams,
  type CustomerFilters,
  type CustomerListParams,
} from '../list-params';
import { CUSTOMER_STATUSES } from '../types';

const t = ar.customers;

export function CustomersListPage() {
  useDocumentTitle(t.title);
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = parseCustomerListParams(searchParams);
  const branches = useBranchOptions();
  const [lookupOpen, setLookupOpen] = useState(false);

  const update = useCallback(
    (
      patch: Partial<Omit<CustomerListParams, 'filter'>> & { filter?: Partial<CustomerFilters> },
    ) => {
      setSearchParams((current) => {
        const base = parseCustomerListParams(current);
        const filter = Object.fromEntries(
          Object.entries<string | number | undefined>({ ...base.filter, ...patch.filter }).filter(
            ([, value]) => value !== undefined,
          ),
        ) as CustomerFilters;
        // Any change other than paging starts again from page 1.
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
    queryKey: customerKeys.list(params),
    queryFn: ({ signal }) => customersApi.list(params, signal),
    placeholderData: keepPreviousData,
  });

  const data = query.data;
  const filtered = hasActiveFilters(params);
  const canCreate = can('customers.create');

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
        {canCreate ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setLookupOpen(true);
              }}
            >
              {t.lookup.open}
            </Button>
            <Link
              to="/customers/new"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-hover"
            >
              + {t.form.create}
            </Link>
          </div>
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
            options={CUSTOMER_SORTS.map((sort) => ({ value: sort, label: t.sorts[sort] }))}
            value={params.sort}
            onChange={(event) => {
              update({ sort: event.target.value as CustomerListParams['sort'] });
            }}
          />
        </div>
        <fieldset className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <legend className="sr-only">{t.filters.label}</legend>
          <Select
            label={t.filters.status}
            placeholder={ar.common.all}
            options={CUSTOMER_STATUSES.map((s) => ({ value: s, label: customerStatusLabels[s] }))}
            value={params.filter.status ?? ''}
            onChange={(event) => {
              update({ filter: { status: event.target.value || undefined } });
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
          <CustomersTable customers={data.items} busy={query.isFetching} />
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

      {lookupOpen ? (
        <CustomerLookupDialog
          onClose={() => {
            setLookupOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}
