/** `2026-11` → `نوفمبر 2026` (short month on the axis). */
export function monthLabel(month: string, style: 'long' | 'short' = 'long'): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
    month: style,
    ...(style === 'long' ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(y, m - 1, 1)));
}

/** Compact amount for axis/labels: 1.25M, 950K. */
export function compactMoney(value: string): string {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
    Number(value),
  );
}
