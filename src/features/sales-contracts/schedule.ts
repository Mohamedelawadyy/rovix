import { fromMinor, toMinor } from '@/lib/money/money';
import type { MoneyString } from '@/lib/api';
import type { InstallmentFrequency } from './types';

/**
 * The backend does not generate installment schedules: the client sends every row and the
 * backend only checks that the amounts add up exactly to (final amount − down payment).
 * This builds an editable starting point:
 * - equal amounts, with the rounding remainder (in piastres) added to the LAST installment;
 * - due dates every 1/3/6/12 months from the start date (end-of-month dates are clamped,
 *   e.g. 31 Jan → 28/29 Feb); "custom" leaves every date after the first for the user.
 */
const MONTHS_PER_STEP: Record<Exclude<InstallmentFrequency, 'custom'>, number> = {
  monthly: 1,
  quarterly: 3,
  semi_annual: 6,
  annual: 12,
};

export interface ScheduleRow {
  amount: string;
  due_date: string;
}

/** `YYYY-MM-DD` + n months, clamped to the last day of the target month. */
export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  const targetMonth = m - 1 + months;
  const year = y + Math.floor(targetMonth / 12);
  const month = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function splitAmount(total: MoneyString, count: number): MoneyString[] {
  const minor = toMinor(total);
  const n = BigInt(count);
  const base = minor / n;
  const remainder = minor - base * n;
  return Array.from({ length: count }, (_, i) =>
    fromMinor(i === count - 1 ? base + remainder : base),
  );
}

export function buildSchedule({
  total,
  count,
  frequency,
  startDate,
}: {
  total: MoneyString;
  count: number;
  frequency: InstallmentFrequency;
  startDate: string;
}): ScheduleRow[] {
  const amounts = splitAmount(total, count);
  return amounts.map((amount, i) => ({
    amount,
    due_date:
      frequency === 'custom'
        ? i === 0
          ? startDate
          : ''
        : addMonths(startDate, i * MONTHS_PER_STEP[frequency]),
  }));
}
