import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/shared/DetailList';
import { formatDate, formatDateTime } from '@/lib/format';
import { formatMoney } from '@/lib/money/money';
import { ar, interpolate } from '@/locales/ar';
import {
  movementStatusLabels,
  movementStatusTone,
  statusSourceLabels,
  vehicleCostTypeLabels,
  vehicleStatusLabels,
  vehicleStatusTone,
} from '../labels';
import type { VehicleCost, VehicleMovement, VehicleStatusChange } from '../types';

const t = ar.vehicles.detail;
const th = 'px-3 py-2 text-start text-xs font-medium text-fg-secondary';
const td = 'px-3 py-2.5 text-sm';
const tdNowrap = `${td} whitespace-nowrap`;

function Empty({ children }: { children: string }) {
  return <p className="text-sm text-fg-muted">{children}</p>;
}

export function StatusTimeline({ changes }: { changes: VehicleStatusChange[] }) {
  return (
    <Card title={t.sections.statusHistory}>
      {changes.length === 0 ? (
        <Empty>{t.history.empty}</Empty>
      ) : (
        <ol className="relative flex flex-col gap-4 border-s border-border ps-5">
          {changes.map((change, i) => {
            const source = change.source
              ? (statusSourceLabels[change.source.type] ?? change.source.type)
              : null;
            return (
              <li key={`${change.created_at}-${String(i)}`} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute -start-[1.65rem] top-1.5 size-2.5 rounded-full bg-accent"
                />
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {change.from_status ? (
                    <>
                      <Badge tone={vehicleStatusTone[change.from_status]}>
                        {vehicleStatusLabels[change.from_status]}
                      </Badge>
                      <span aria-hidden="true" className="text-fg-muted">
                        ←
                      </span>
                    </>
                  ) : (
                    <span className="text-fg-secondary">{t.history.initial}:</span>
                  )}
                  <Badge tone={vehicleStatusTone[change.to_status]}>
                    {vehicleStatusLabels[change.to_status]}
                  </Badge>
                </div>
                {change.reason ? <p className="mt-1 text-sm text-fg">{change.reason}</p> : null}
                <p className="mt-1 text-xs text-fg-muted">
                  {[
                    formatDateTime(change.created_at),
                    change.changed_by
                      ? interpolate(t.history.by, { name: change.changed_by.name })
                      : null,
                    source ? interpolate(t.history.via, { source }) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}

export function MovementsTable({ movements }: { movements: VehicleMovement[] }) {
  const c = t.movements;
  return (
    <Card title={t.sections.movements}>
      {movements.length === 0 ? (
        <Empty>{c.empty}</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem]">
            <thead className="bg-surface-muted">
              <tr>
                <th scope="col" className={th}>
                  {c.reference}
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
                  {c.completedAt}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {movements.map((movement) => (
                <tr key={movement.id}>
                  <td className={tdNowrap} dir="ltr">
                    <span className="inline-block">{movement.reference}</span>
                  </td>
                  <td className={td}>
                    {movement.from_branch?.name ?? '—'} ← {movement.to_branch?.name ?? '—'}
                  </td>
                  <td className={td}>
                    <Badge tone={movementStatusTone[movement.status]}>
                      {movementStatusLabels[movement.status]}
                    </Badge>
                  </td>
                  <td className={tdNowrap}>{formatDateTime(movement.initiated_at)}</td>
                  <td className={tdNowrap}>{formatDateTime(movement.completed_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function CostsTable({ costs }: { costs: VehicleCost[] }) {
  const c = t.costs;
  return (
    <Card title={t.sections.costs}>
      {costs.length === 0 ? (
        <Empty>{c.empty}</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem]">
            <thead className="bg-surface-muted">
              <tr>
                <th scope="col" className={th}>
                  {c.type}
                </th>
                <th scope="col" className={th}>
                  {c.date}
                </th>
                <th scope="col" className={th}>
                  {c.description}
                </th>
                <th scope="col" className={`${th} text-end`}>
                  {c.amount}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {costs.map((cost) => (
                <tr key={cost.id}>
                  <td className={td}>{vehicleCostTypeLabels[cost.cost_type]}</td>
                  <td className={tdNowrap}>{formatDate(cost.cost_date)}</td>
                  <td className={`${td} text-fg-secondary`}>{cost.description ?? '—'}</td>
                  <td className={`${td} text-end tabular-nums`}>
                    {formatMoney(cost.amount, { withCurrency: false })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
