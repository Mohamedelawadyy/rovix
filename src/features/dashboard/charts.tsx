import { useState } from 'react';
import { compareMoney, formatMoney } from '@/lib/money/money';
import { formatNumber } from '@/lib/format';
import { ar, interpolate } from '@/locales/ar';
import { compactMoney, monthLabel } from './format';

const t = ar.dashboard.charts;

export interface MonthPoint {
  month: string;
  total: string;
  count: number;
}

/**
 * Single-series column chart (one hue, so no legend; the card title names it).
 * Thin columns with rounded tops on a shared baseline, recessive gridlines,
 * a hover/focus tooltip per column, and a screen-reader table with the same data.
 */
export function MonthlyColumns({ points, label }: { points: MonthPoint[]; label: string }) {
  const [active, setActive] = useState<number | null>(null);
  if (points.length === 0) return <p className="text-sm text-fg-muted">{t.empty}</p>;

  const max = points.reduce((m, p) => (compareMoney(p.total, m) > 0 ? p.total : m), '0');
  const maxN = Number(max) || 1;
  const ticks = [0, 0.5, 1].map((f) => maxN * f);
  const shown = active === null ? null : points[active];

  return (
    <figure className="flex flex-col gap-2">
      <div className="relative h-56" dir="ltr">
        {/* Gridlines + y labels */}
        {ticks.map((value) => (
          <div
            key={value}
            className="absolute inset-x-0 flex translate-y-1/2 items-center gap-2"
            style={{ bottom: `${String((value / maxN) * 85 + 10)}%` }}
            aria-hidden="true"
          >
            <span className="w-10 shrink-0 text-end text-[11px] text-fg-muted tabular-nums">
              {compactMoney(String(value))}
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>
        ))}
        <div className="absolute start-12 end-0 top-0 bottom-[10%] flex items-end gap-0.5">
          {points.map((p, i) => {
            const height = (Number(p.total) / maxN) * 85;
            return (
              <button
                key={p.month}
                type="button"
                className="group flex h-full min-w-0 flex-1 items-end justify-center outline-none"
                aria-label={interpolate(t.tooltip, {
                  month: monthLabel(p.month),
                  total: formatMoney(p.total),
                  count: formatNumber(p.count),
                })}
                onMouseEnter={() => {
                  setActive(i);
                }}
                onMouseLeave={() => {
                  setActive(null);
                }}
                onFocus={() => {
                  setActive(i);
                }}
                onBlur={() => {
                  setActive(null);
                }}
              >
                <span
                  className={`block w-full max-w-8 rounded-t bg-primary transition-opacity group-focus-visible:ring-2 group-focus-visible:ring-accent ${
                    active !== null && active !== i ? 'opacity-40' : ''
                  }`}
                  style={{ height: `${String(Math.max(height, p.count > 0 ? 1 : 0) / 0.9)}%` }}
                />
              </button>
            );
          })}
        </div>
        {shown ? (
          <div
            role="status"
            className="pointer-events-none absolute end-0 top-0 rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-md"
            dir="rtl"
          >
            <div className="font-semibold text-fg">{monthLabel(shown.month)}</div>
            <div className="text-fg-secondary">{formatMoney(shown.total)}</div>
            <div className="text-fg-muted">
              {interpolate(ar.dashboard.kpis.contracts, { count: formatNumber(shown.count) })}
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex gap-0.5 ps-12" dir="ltr" aria-hidden="true">
        {points.map((p, i) => (
          <span
            key={p.month}
            className="min-w-0 flex-1 truncate text-center text-[11px] text-fg-muted"
          >
            {points.length <= 12 || i % Math.ceil(points.length / 12) === 0
              ? monthLabel(p.month, 'short')
              : ''}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">{t.month}</th>
            <th scope="col">{t.total}</th>
            <th scope="col">{t.contracts}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.month}>
              <th scope="row">{monthLabel(p.month)}</th>
              <td>{formatMoney(p.total)}</td>
              <td>{formatNumber(p.count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export interface RankedItem {
  key: string;
  label: string;
  /** Money string or a count. */
  value: string | number;
  detail?: string;
}

/**
 * Ranked horizontal bars (one hue). Every bar is direct-labeled with its value, so it reads
 * without hover and without color; it is a list, so screen readers get it as text.
 */
export function RankedBars({
  items,
  format = 'money',
}: {
  items: RankedItem[];
  format?: 'money' | 'count';
}) {
  if (items.length === 0) return <p className="text-sm text-fg-muted">{t.empty}</p>;
  const max = Math.max(...items.map((i) => Number(i.value)), 1);

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-fg">{item.label}</span>
            <span className="shrink-0 font-medium text-fg tabular-nums">
              {format === 'money'
                ? formatMoney(String(item.value), { withCurrency: false })
                : formatNumber(Number(item.value))}
              {item.detail ? (
                <span className="ms-1.5 text-xs font-normal text-fg-muted">{item.detail}</span>
              ) : null}
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-muted" aria-hidden="true">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${String(Math.max((Number(item.value) / max) * 100, 1))}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
