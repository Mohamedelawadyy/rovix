import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { ForbiddenPage, NotFoundPage } from '@/app/pages/StatusPages';
import { Card, DetailList, type DetailItem } from '@/components/shared/DetailList';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth/auth-context';
import { useBranchOptions } from '@/features/branches/use-branch-options';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { isApiError } from '@/lib/api';
import { getErrorMessage } from '@/lib/api/error-message';
import { formatDateTime } from '@/lib/format';
import { parseRouteId } from '@/lib/route-id';
import { ar, interpolate } from '@/locales/ar';
import { reservationKeys, reservationsApi } from '../api/reservations-api';
import { ReleaseReservationDialog } from '../components/ReleaseReservationDialog';
import { reservationStatusLabels, reservationStatusTone } from '../labels';
import { isOverdue } from '../types';

const t = ar.reservations.detail;
const NA = ar.common.notAvailable;
const linkClass = 'text-accent hover:underline';

/** List URL state carried by links into the page, so "back" restores filters and page. */
export interface ReservationDetailLinkState {
  listSearch?: string;
  notice?: string;
}

export function ReservationDetailPage() {
  const id = parseRouteId(useParams().reservationId);
  if (id === null) return <NotFoundPage />;
  return <ReservationDetail id={id} />;
}

function ReservationDetail({ id }: { id: number }) {
  const { can } = useAuth();
  const branches = useBranchOptions();
  const location = useLocation();
  const linkState = location.state as ReservationDetailLinkState | null;
  const [notice, setNotice] = useState<string | null>(linkState?.notice ?? null);
  const [releasing, setReleasing] = useState(false);

  const query = useQuery({
    queryKey: reservationKeys.detail(id),
    queryFn: ({ signal }) => reservationsApi.get(id, signal),
  });
  const reservation = query.data;
  useDocumentTitle(reservation ? reservation.number : ar.reservations.title);

  const error = query.error;
  if (isApiError(error) && error.kind === 'not_found') return <NotFoundPage />;
  if (isApiError(error) && error.kind === 'forbidden') return <ForbiddenPage />;

  const backLink = (
    <Link
      to={`/reservations${linkState?.listSearch ?? ''}`}
      className="text-sm text-accent hover:underline"
    >
      → {t.back}
    </Link>
  );

  if (!reservation) {
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
  const { vehicle, customer } = reservation;
  const branchName =
    branches.options.find((b) => b.value === String(reservation.branch_id))?.label ?? NA;
  const details: DetailItem[] = [
    {
      label: f.vehicle,
      value: vehicle ? (
        <span className="flex flex-col gap-0.5">
          <Link to={`/vehicles/${String(vehicle.id)}`} className={linkClass}>
            <span dir="ltr" className="inline-block">
              {vehicle.stock_number}
            </span>
          </Link>
          {vehicle.vin ? (
            <span dir="ltr" className="self-start text-xs text-fg-muted">
              <span className="inline-block">{vehicle.vin}</span>
            </span>
          ) : null}
        </span>
      ) : (
        NA
      ),
    },
    {
      label: f.customer,
      value: customer ? (
        <Link to={`/customers/${String(customer.id)}`} className={linkClass}>
          {customer.name}{' '}
          <span dir="ltr" className="inline-block text-xs text-fg-muted">
            {customer.customer_code}
          </span>
        </Link>
      ) : (
        NA
      ),
    },
    { label: f.branch, value: branchName },
    { label: f.createdAt, value: formatDateTime(reservation.created_at) },
    {
      label: f.expiresAt,
      value: reservation.expires_at
        ? formatDateTime(reservation.expires_at)
        : ar.reservations.noExpiry,
    },
    ...(reservation.sales_contract_id !== null
      ? [
          {
            label: f.contract,
            value: interpolate(t.contractLinked, { id: reservation.sales_contract_id }),
          },
        ]
      : []),
    ...(reservation.status === 'released'
      ? [
          { label: f.releasedAt, value: formatDateTime(reservation.released_at) },
          { label: f.releaseReason, value: reservation.release_reason ?? NA },
        ]
      : []),
  ];

  const canRelease = reservation.status === 'active' && can('reservations.cancel');

  return (
    <article className="flex flex-col gap-5">
      {backLink}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-fg" dir="ltr">
            <span className="inline-block">{reservation.number}</span>
          </h1>
          {customer ? <p className="mt-1 text-sm text-fg-muted">{customer.name}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={reservationStatusTone[reservation.status]}>
            {reservationStatusLabels[reservation.status]}
          </Badge>
          {isOverdue(reservation) ? <Badge tone="warning">{ar.reservations.overdue}</Badge> : null}
          {canRelease ? (
            <Button
              variant="danger"
              onClick={() => {
                setReleasing(true);
              }}
            >
              {ar.reservations.release.open}
            </Button>
          ) : null}
        </div>
      </header>

      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {isOverdue(reservation) ? <Alert tone="warning">{t.overdueHint}</Alert> : null}

      <Card title={t.sections.info}>
        <DetailList items={details} />
      </Card>

      {reservation.notes ? (
        <Card title={t.sections.notes}>
          <p className="text-sm whitespace-pre-line text-fg">{reservation.notes}</p>
        </Card>
      ) : null}

      {releasing ? (
        <ReleaseReservationDialog
          reservation={reservation}
          onClose={() => {
            setReleasing(false);
          }}
          onDone={(message) => {
            setReleasing(false);
            setNotice(message);
          }}
        />
      ) : null}
    </article>
  );
}
