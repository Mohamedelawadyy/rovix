/** Display formatting shared by all pages. Latin digits (`-u-nu-latn`) keep tables consistent. */
const DEFAULT_LOCALE = 'ar-EG';

export function formatNumber(value: number, locale = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(`${locale}-u-nu-latn`).format(value);
}

/** `YYYY-MM-DD` → localized date, without timezone shifts. */
export function formatDate(value: string | null | undefined, locale = DEFAULT_LOCALE): string {
  if (!value) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return new Intl.DateTimeFormat(`${locale}-u-nu-latn`, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/** ISO timestamp → localized date and time in the business timezone (Africa/Cairo). */
export function formatDateTime(
  value: string | null | undefined,
  locale = DEFAULT_LOCALE,
  timeZone = 'Africa/Cairo',
): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(`${locale}-u-nu-latn`, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(date);
}
