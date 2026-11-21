import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Pagination } from '@/components/shared/Pagination';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/features/auth/auth-context';
import { canAccessBranch } from '@/features/auth/permissions';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getErrorMessage } from '@/lib/api/error-message';
import { formatDateTime } from '@/lib/format';
import { ar } from '@/locales/ar';
import { vehicleKeys, vehiclesApi } from '../api/vehicles-api';
import { TransferActions } from '../components/TransferActions';
import { movementStatusLabels, movementStatusTone } from '../labels';
import { MOVEMENT_STATUSES, type MovementStatus } from '../types';

const t = ar.vehicles.transfers;
const c = ar.vehicles.detail.movements;
const th = 'px-4 py-3 text-start text-xs font-medium text-fg-secondary';
const td = 'px-4 py-3 text-sm';

function parseStatus(value: string | null): MovementStatus | undefined {
  return (MOVEMENT_STATUSES as readonly string[]).includes(value ?? '')
    ? (value as MovementStatus)
    : undefined;
}

/**
 * /vehicles/transfers — movements touching the user's branches. The destination branch
 * receives here: it cannot open the vehicle page while the vehicle still belongs to the source.
 * Defaults to open (in-transit) transfers; `?status=all` shows everything.
 */
export function VehicleTransfersPage() {
  useDocumentTitle(t.title);
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [notice, setNotice] = useState<string | null>(null);
  const statusParam = params.get('status');
  const status = statusParam === 'all' ? undefined : (parseStatus(statusParam) ?? 'in_transit');
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);

  const query = useQuery({
    queryKey: vehicleKeys.transfers({ page, status }),
    queryFn: ({ signal }) => vehiclesApi.transfers({ page, status }, signal),
    placeholderData: keepPreviousData,
  });
  const data = query.data;

  return (
    <section className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <Link to="/vehicles" className="text-sm text-accent hover:underline">
          → {ar.vehicles.detail.back}
        </Link>
        <h1 className="text-2xl font-semibold text-fg">{t.title}</h1>
      </header>

      <div className="w-full max-w-xs">
        <Select
          label={ar.vehicles.filters.status}
          options={[
            ...MOVEMENT_STATUSES.map((value) => ({ value, label: movementStatusLabels[value] })),
            { value: 'all', label: ar.common.all },
          ]}
          value={status ?? 'all'}
          onChange={(event) => {
            setNotice(null);
            setParams(event.target.value === 'in_transit' ? {} : { status: event.target.value });
          }}
        />
      </div>

      {notice ? <Alert tone="success">{notice}</Alert> : null}

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
        <p className="rounded-lg border border-dashed border-border-strong bg-surface p-10 text-center text-fg-muted">
          {t.empty}
        </p>
      ) : null}

      {data && data.items.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table aria-busy={query.isFetching} className="w-full min-w-[52rem]">
              <caption className="sr-only">{t.title}</caption>
              <thead className="bg-surface-muted">
                <tr>
                  <th scope="col" className={th}>
                    {c.reference}
                  </th>
                  <th scope="col" className={th}>
                    {t.vehicle}
                  </th>
                  <th scope="col" className={th}>
                    {c.route}
                  </th>
                  <th scope="col" className={th}>
                    {c.status}
                  </th>
                  <th scope="col" className={th}>
                    {c.initiatedAt}
                  </th>
                  <th scope="col" className={th}>
                    <span className="sr-only">{ar.vehicles.actions.label}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((movement) => {
                  const incoming =
                    canAccessBranch(user, movement.to_branch?.id) &&
                    !canAccessBranch(user, movement.from_branch?.id);
                  const outgoing =
                    canAccessBranch(user, movement.from_branch?.id) &&
                    !canAccessBranch(user, movement.to_branch?.id);
                  return (
                    <tr key={movement.id}>
                      <td className={`${td} whitespace-nowrap`} dir="ltr">
                        <span className="inline-block">{movement.reference}</span>
                      </td>
                      <td className={`${td} whitespace-nowrap`}>
                        {movement.vehicle ? (
                          <Link
                            to={`/vehicles/${String(movement.vehicle.id)}`}
                            className="text-fg hover:text-accent hover:underline"
                            dir="ltr"
                          >
                            {movement.vehicle.stock_number}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className={td}>
                        {movement.from_branch?.name ?? '—'} ← {movement.to_branch?.name ?? '—'}{' '}
                        {incoming ? <Badge tone="accent">{t.incoming}</Badge> : null}
                        {outgoing ? <Badge tone="neutral">{t.outgoing}</Badge> : null}
                      </td>
                      <td className={td}>
                        <Badge tone={movementStatusTone[movement.status]}>
                          {movementStatusLabels[movement.status]}
                        </Badge>
                      </td>
                      <td className={`${td} whitespace-nowrap`}>
                        {formatDateTime(movement.initiated_at)}
                      </td>
                      <td className={td}>
                        <TransferActions movement={movement} onDone={setNotice} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            meta={data.pagination}
            onPageChange={(next) => {
              const nextParams = new URLSearchParams(params);
              nextParams.set('page', String(next));
              setParams(nextParams);
            }}
          />
        </>
      ) : null}
    </section>
  );
}
