import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { Card, DetailList, type DetailItem } from '@/components/shared/DetailList';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ForbiddenPage, NotFoundPage } from '@/app/pages/StatusPages';
import { useAuth } from '@/features/auth/auth-context';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { isApiError } from '@/lib/api';
import { getErrorMessage } from '@/lib/api/error-message';
import { formatDate, formatNumber } from '@/lib/format';
import { formatMoney } from '@/lib/money/money';
import { ar, interpolate } from '@/locales/ar';
import { vehicleKeys, vehiclesApi } from '../api/vehicles-api';
import { TransferActions } from '../components/TransferActions';
import { VehicleActions } from '../components/VehicleActions';
import { VehicleGallery } from '../components/VehicleGallery';
import { VehicleImagesManager } from '../components/VehicleImagesManager';
import { CostsTable, MovementsTable, StatusTimeline } from '../components/VehicleHistorySections';
import {
  fuelTypeLabels,
  transmissionLabels,
  vehicleStatusLabels,
  vehicleStatusTone,
  vehicleTypeLabels,
} from '../labels';
import type { Vehicle } from '../types';
import { parseVehicleId } from '../vehicle-id';

const t = ar.vehicles.detail;
const NA = ar.common.notAvailable;
const money = (value: string | null | undefined) => (value ? formatMoney(value) : NA);

/** List URL state carried by the list page's links, so "back" restores filters and page. */
export interface VehicleDetailLinkState {
  listSearch?: string;
  /** One-off confirmation after a save (e.g. "Changes saved"). */
  notice?: string;
}

function vehicleName(vehicle: Vehicle): string {
  return [vehicle.brand?.name, vehicle.model?.name, vehicle.year].filter(Boolean).join(' ');
}

export function VehicleDetailPage() {
  const id = parseVehicleId(useParams().vehicleId);
  if (id === null) return <NotFoundPage />;
  return <VehicleDetail id={id} />;
}

function VehicleDetail({ id }: { id: number }) {
  const { can } = useAuth();
  const location = useLocation();
  const linkState = location.state as VehicleDetailLinkState | null;
  const listSearch = linkState?.listSearch ?? '';
  // Confirmation after an action on this page (or a save on the form page).
  const [notice, setNotice] = useState<string | null>(linkState?.notice ?? null);

  const vehicleQuery = useQuery({
    queryKey: vehicleKeys.detail(id),
    queryFn: ({ signal }) => vehiclesApi.get(id, signal),
  });
  const historyQuery = useQuery({
    queryKey: vehicleKeys.history(id),
    queryFn: ({ signal }) => vehiclesApi.history(id, signal),
    enabled: vehicleQuery.isSuccess,
  });

  const vehicle = vehicleQuery.data;
  useDocumentTitle(
    vehicle ? `${vehicle.stock_number} · ${vehicleName(vehicle)}` : ar.vehicles.title,
  );

  const error = vehicleQuery.error;
  if (isApiError(error) && error.kind === 'not_found') return <NotFoundPage />;
  // Another branch's vehicle: the backend policy answers 403.
  if (isApiError(error) && error.kind === 'forbidden') return <ForbiddenPage />;

  const backLink = (
    <Link to={`/vehicles${listSearch}`} className="text-sm text-accent hover:underline">
      → {t.back}
    </Link>
  );

  if (vehicleQuery.isPending) {
    return (
      <section className="flex flex-col gap-4">
        {backLink}
        <p role="status" className="py-12 text-center text-fg-muted">
          {ar.common.loading}
        </p>
      </section>
    );
  }

  if (!vehicle) {
    return (
      <section className="flex flex-col gap-4">
        {backLink}
        <Alert tone="danger">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {ar.list.loadError} {getErrorMessage(error)}
            </span>
            <Button
              variant="secondary"
              onClick={() => {
                void vehicleQuery.refetch();
              }}
            >
              {ar.common.retry}
            </Button>
          </div>
        </Alert>
      </section>
    );
  }

  const f = t.fields;
  const details: DetailItem[] = [
    { label: f.vin, value: vehicle.vin ?? NA, ltr: true },
    { label: f.engineNumber, value: vehicle.engine_number ?? NA, ltr: true },
    { label: f.color, value: vehicle.color ?? NA },
    {
      label: f.mileage,
      value: interpolate(ar.vehicles.km, { value: formatNumber(vehicle.mileage) }),
    },
    { label: f.transmission, value: transmissionLabels[vehicle.transmission] },
    { label: f.fuelType, value: fuelTypeLabels[vehicle.fuel_type] },
    { label: f.vehicleType, value: vehicleTypeLabels[vehicle.vehicle_type] },
    { label: f.branch, value: vehicle.branch?.name ?? NA },
    { label: f.supplier, value: vehicle.supplier?.name ?? NA },
    { label: f.purchaseDate, value: formatDate(vehicle.purchase_date) },
  ];

  // Cost fields are omitted by the backend without vehicles.view-cost.
  const showCost = can('vehicles.view-cost') && vehicle.total_cost !== undefined;
  const pricing: DetailItem[] = [
    { label: f.sellingPrice, value: money(vehicle.selling_price) },
    ...(showCost
      ? [
          { label: f.purchasePrice, value: money(vehicle.purchase_price) },
          { label: f.additionalCosts, value: money(vehicle.additional_costs) },
          { label: f.totalCost, value: money(vehicle.total_cost) },
        ]
      : []),
  ];

  const specifications = Object.entries(vehicle.specifications ?? {});
  const history = historyQuery.data;
  const openTransfer = history?.movements.find((movement) => movement.status === 'in_transit');

  return (
    <article className="flex flex-col gap-5">
      {backLink}

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-fg">{vehicleName(vehicle)}</h1>
          <p className="mt-1 text-sm text-fg-muted" dir="ltr">
            <span className="inline-block">{vehicle.stock_number}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={vehicleStatusTone[vehicle.status]}>
            {vehicleStatusLabels[vehicle.status]}
          </Badge>
          {can('vehicles.update') ? (
            <Link
              to={`/vehicles/${String(vehicle.id)}/edit`}
              className="inline-flex h-10 items-center rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-fg hover:bg-surface-muted"
            >
              {ar.vehicles.form.edit}
            </Link>
          ) : null}
        </div>
      </header>

      <VehicleActions vehicle={vehicle} name={vehicleName(vehicle)} onDone={setNotice} />

      {notice ? <Alert tone="success">{notice}</Alert> : null}

      {openTransfer ? (
        <div className="flex flex-col gap-3 rounded-lg border border-info-subtle bg-info-subtle p-4 text-sm text-info-strong sm:flex-row sm:items-center sm:justify-between">
          <p>
            {interpolate(ar.vehicles.actions.openTransfer, {
              from: openTransfer.from_branch?.name ?? '—',
              to: openTransfer.to_branch?.name ?? '—',
              reference: openTransfer.reference,
            })}
          </p>
          <TransferActions movement={openTransfer} onDone={setNotice} />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <VehicleGallery images={vehicle.images} name={vehicleName(vehicle)} />
        <div className="flex flex-col gap-5">
          <Card title={t.sections.pricing}>
            <DetailList items={pricing} />
          </Card>
          <Card title={t.sections.details}>
            <DetailList items={details} />
          </Card>
        </div>
      </div>

      {can('vehicles.update') ? (
        <VehicleImagesManager vehicle={vehicle} onDone={setNotice} />
      ) : null}

      {vehicle.description ? (
        <Card title={t.sections.description}>
          <p className="text-sm whitespace-pre-line text-fg">{vehicle.description}</p>
        </Card>
      ) : null}

      {specifications.length > 0 ? (
        <Card title={t.sections.specifications}>
          <DetailList items={specifications.map(([label, value]) => ({ label, value }))} />
        </Card>
      ) : null}

      {historyQuery.isError ? (
        <Alert tone="danger">
          {t.historyError} {getErrorMessage(historyQuery.error)}
        </Alert>
      ) : null}
      {history ? (
        <>
          <StatusTimeline changes={history.status_history} />
          <MovementsTable movements={history.movements} />
          {history.costs ? <CostsTable costs={history.costs} /> : null}
        </>
      ) : null}
    </article>
  );
}
