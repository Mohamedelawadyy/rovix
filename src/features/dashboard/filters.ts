import type { DashboardFilters } from './api';

/**
 * Dashboard filters live in the URL. The backend accepts date_from / date_to (any parseable
 * date) and branch_id (must be one of the user's branches). No dates = all time.
 */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const PERIODS = ['all', 'month', 'quarter', 'year', 'custom'] as const;
export type Period = (typeof PERIODS)[number];

function iso(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/** Date range for a preset period, relative to `today`. */
export function periodRange(period: Period, today = new Date()): DashboardFilters {
  const y = today.getFullYear();
  const m = today.getMonth();
  switch (period) {
    case 'month':
      return { date_from: iso(new Date(y, m, 1)), date_to: iso(today) };
    case 'quarter':
      return { date_from: iso(new Date(y, m - 2, 1)), date_to: iso(today) };
    case 'year':
      return { date_from: iso(new Date(y, 0, 1)), date_to: iso(today) };
    default:
      return {};
  }
}

export interface DashboardParams {
  period: Period;
  filters: DashboardFilters;
}

function validDate(value: string | null): string | undefined {
  return value && ISO_DATE.test(value) && !Number.isNaN(Date.parse(value)) ? value : undefined;
}

export function parseDashboardParams(search: URLSearchParams, today = new Date()): DashboardParams {
  const raw = search.get('period');
  const period: Period = (PERIODS as readonly string[]).includes(raw ?? '')
    ? (raw as Period)
    : 'all';
  const branch = search.get('branch_id');
  const branchId =
    branch && /^\d+$/.test(branch) && Number(branch) > 0 ? Number(branch) : undefined;

  let dates: DashboardFilters = periodRange(period, today);
  if (period === 'custom') {
    let from = validDate(search.get('date_from'));
    let to = validDate(search.get('date_to'));
    if (from && to && from > to) [from, to] = [to, from];
    dates = { ...(from ? { date_from: from } : {}), ...(to ? { date_to: to } : {}) };
  }
  return { period, filters: { ...dates, ...(branchId ? { branch_id: branchId } : {}) } };
}

export function toSearchParams(params: DashboardParams): URLSearchParams {
  const out = new URLSearchParams();
  if (params.period !== 'all') out.set('period', params.period);
  if (params.period === 'custom') {
    if (params.filters.date_from) out.set('date_from', params.filters.date_from);
    if (params.filters.date_to) out.set('date_to', params.filters.date_to);
  }
  if (params.filters.branch_id) out.set('branch_id', String(params.filters.branch_id));
  return out;
}
