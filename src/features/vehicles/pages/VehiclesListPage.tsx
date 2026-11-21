import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Pagination } from '@/components/shared/Pagination';
import { SearchInput } from '@/components/shared/SearchInput';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/features/auth/auth-context';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getErrorMessage } from '@/lib/api/error-message';
import { formatNumber } from '@/lib/format';
import { ar, interpolate } from '@/locales/ar';
import { vehicleKeys, vehiclesApi } from '../api/vehicles-api';
import { VehicleFilters } from '../components/VehicleFilters';
import { VehiclesTable } from '../components/VehiclesTable';
import {
  hasActiveFilters,
  PAGE_SIZES,
  parseVehicleListParams,
  toSearchParams,
  VEHICLE_SORTS,
  type VehicleFilters as Filters,
  type VehicleListParams,
} from '../list-params';

const t = ar.vehicles;

export function VehiclesListPage() {
  useDocumentTitle(t.title);
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const params = parseVehicleListParams(searchParams);

  const update = useCallback(
    (patch: Partial<Omit<VehicleListParams, 'filter'>> & { filter?: Partial<Filters> }) => {
      setSearchParams((current) => {
        const base = parseVehicleListParams(current);
        const filter = Object.fromEntries(
          Object.entries<string | number | undefined>({ ...base.filter, ...patch.filter }).filter(
            ([, v]) => v !== undefined,
          ),
        ) as Filters;
        // Any change other than paging starts again from page 1.
        const page = patch.page ?? 1;
        return toSearchParams({ ...base, ...patch, filter, page });
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
    queryKey: vehicleKeys.list(params),
    queryFn: ({ signal }) => vehiclesApi.list(params, signal),
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
        {can('vehicles.create') ? (
          <Link
            to="/vehicles/new"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-hover"
          >
            + {ar.vehicles.form.create}
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
            options={VEHICLE_SORTS.map((sort) => ({ value: sort, label: t.sorts[sort] }))}
            value={params.sort}
            onChange={(event) => {
              update({ sort: event.target.value as VehicleListParams['sort'] });
            }}
          />
        </div>
        <VehicleFilters
          filter={params.filter}
          onChange={(patch) => {
            update({ filter: patch });
          }}
        />
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
          <h2 className="font-semibold text-fg">
            {filtered ? t.emptyTitle : t.emptyInventoryTitle}
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            {filtered ? t.emptyBody : t.emptyInventoryBody}
          </p>
        </div>
      ) : null}

      {data && data.items.length > 0 ? (
        <>
          <VehiclesTable
            vehicles={data.items}
            showCost={can('vehicles.view-cost')}
            busy={query.isFetching}
          />
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
