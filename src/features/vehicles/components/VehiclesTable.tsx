import { Link, useLocation } from 'react-router';
import { Badge } from '@/components/ui/Badge';
import { formatNumber } from '@/lib/format';
import { formatMoney } from '@/lib/money/money';
import { ar, interpolate } from '@/locales/ar';
import {
  fuelTypeLabels,
  transmissionLabels,
  vehicleStatusLabels,
  vehicleStatusTone,
  vehicleTypeLabels,
} from '../labels';
import type { VehicleDetailLinkState } from '../pages/VehicleDetailPage';
import type { Vehicle } from '../types';

const c = ar.vehicles.columns;
const money = (value: string | null | undefined) =>
  value ? formatMoney(value, { withCurrency: false }) : ar.common.notAvailable;

export function VehiclesTable({
  vehicles,
  showCost,
  busy,
}: {
  vehicles: Vehicle[];
  /** Only with `vehicles.view-cost`; the backend omits cost fields otherwise. */
  showCost: boolean;
  busy: boolean;
}) {
  const location = useLocation();
  const linkState: VehicleDetailLinkState = { listSearch: location.search };

  return (
    // Wide tables scroll inside their card on small screens; the page itself never scrolls sideways.
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table aria-busy={busy} className="w-full min-w-[56rem] text-sm">
        <caption className="sr-only">{ar.vehicles.title}</caption>
        <thead className="bg-surface-muted text-xs text-fg-secondary">
          <tr>
            <th scope="col" className="px-4 py-3 text-start font-medium">
              {c.stockNumber}
            </th>
            <th scope="col" className="px-4 py-3 text-start font-medium">
              {c.vehicle}
            </th>
            <th scope="col" className="px-4 py-3 text-start font-medium">
              {c.specs}
            </th>
            <th scope="col" className="px-4 py-3 text-start font-medium">
              {c.mileage}
            </th>
            <th scope="col" className="px-4 py-3 text-start font-medium">
              {c.branch}
            </th>
            {showCost ? (
              <th scope="col" className="px-4 py-3 text-end font-medium">
                {c.totalCost}
              </th>
            ) : null}
            <th scope="col" className="px-4 py-3 text-end font-medium">
              {c.sellingPrice}
            </th>
            <th scope="col" className="px-4 py-3 text-start font-medium">
              {c.status}
            </th>
          </tr>
        </thead>
        <tbody className={`divide-y divide-border ${busy ? 'opacity-60' : ''}`}>
          {vehicles.map((vehicle) => (
            <tr key={vehicle.id} className="hover:bg-canvas">
              <td className="px-4 py-3 font-medium whitespace-nowrap" dir="ltr">
                {vehicle.stock_number}
              </td>
              <td className="px-4 py-3">
                <Link
                  to={`/vehicles/${String(vehicle.id)}`}
                  state={linkState}
                  className="font-medium text-fg hover:text-accent hover:underline"
                >
                  {[vehicle.brand?.name, vehicle.model?.name].filter(Boolean).join(' ')}{' '}
                  <span className="text-fg-muted">{vehicle.year}</span>
                </Link>
                <div className="text-xs text-fg-muted">
                  {[vehicle.color, vehicle.vin].filter(Boolean).join(' · ') ||
                    ar.common.notAvailable}
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-fg-secondary">
                {vehicleTypeLabels[vehicle.vehicle_type]} · {fuelTypeLabels[vehicle.fuel_type]} ·{' '}
                {transmissionLabels[vehicle.transmission]}
              </td>
              <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                {interpolate(ar.vehicles.km, { value: formatNumber(vehicle.mileage) })}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {vehicle.branch?.name ?? ar.common.notAvailable}
              </td>
              {showCost ? (
                <td className="px-4 py-3 text-end whitespace-nowrap tabular-nums">
                  {money(vehicle.total_cost)}
                </td>
              ) : null}
              <td className="px-4 py-3 text-end font-medium whitespace-nowrap tabular-nums">
                {money(vehicle.selling_price)}
              </td>
              <td className="px-4 py-3">
                <Badge tone={vehicleStatusTone[vehicle.status]}>
                  {vehicleStatusLabels[vehicle.status]}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
