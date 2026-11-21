import type { MoneyString } from '@/lib/api/types';

/**
 * Exact money arithmetic for the backend's NUMERIC(15,2) amounts (BACKEND_API_REFERENCE.md §2).
 * Values are handled as integer minor units (piastres) in bigint, never as floats.
 */

const MONEY_PATTERN = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;
const SCALE = 100n;

export class MoneyFormatError extends TypeError {
  override name = 'MoneyFormatError';
}

/** `"1250.5"` → `125050n`. Accepts strings with up to 2 decimals, or numbers (rounded to 2 decimals). */
export function toMinor(value: MoneyString | number): bigint {
  const text = typeof value === 'number' ? numberToMoneyText(value) : value.trim();
  const match = MONEY_PATTERN.exec(text);
  if (!match?.[2]) {
    throw new MoneyFormatError(`Invalid money value "${String(value)}".`);
  }

  const [, sign, whole, fraction = ''] = match;
  const minor = BigInt(whole) * SCALE + BigInt(fraction.padEnd(2, '0'));
  return sign ? -minor : minor;
}

/** `125050n` → `"1250.50"` (the backend wire format). */
export function fromMinor(minor: bigint): MoneyString {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const whole = abs / SCALE;
  const fraction = (abs % SCALE).toString().padStart(2, '0');
  return `${negative ? '-' : ''}${whole.toString()}.${fraction}`;
}

/** Normalizes any accepted input to `"0.00"` format. */
export function normalizeMoney(value: MoneyString | number): MoneyString {
  return fromMinor(toMinor(value));
}

export function addMoney(...values: (MoneyString | number)[]): MoneyString {
  return fromMinor(values.reduce<bigint>((sum, value) => sum + toMinor(value), 0n));
}

export function subtractMoney(a: MoneyString | number, b: MoneyString | number): MoneyString {
  return fromMinor(toMinor(a) - toMinor(b));
}

/** -1, 0 or 1. */
export function compareMoney(a: MoneyString | number, b: MoneyString | number): -1 | 0 | 1 {
  const diff = toMinor(a) - toMinor(b);
  return diff === 0n ? 0 : diff > 0n ? 1 : -1;
}

export function isZeroMoney(value: MoneyString | number): boolean {
  return toMinor(value) === 0n;
}

export interface FormatMoneyOptions {
  locale?: string;
  currency?: string;
  /** Show the currency symbol/code (default true). */
  withCurrency?: boolean;
}

/**
 * Display formatting with Intl. The decimal string is passed to Intl directly, so large
 * amounts are formatted exactly. Uses Latin digits (`-u-nu-latn`) for consistent tables.
 */
export function formatMoney(
  value: MoneyString | number,
  { locale = 'ar-EG', currency = 'EGP', withCurrency = true }: FormatMoneyOptions = {},
): string {
  const formatter = new Intl.NumberFormat(`${locale}-u-nu-latn`, {
    ...(withCurrency ? { style: 'currency', currency } : {}),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(normalizeMoney(value) as `${number}`);
}

function numberToMoneyText(value: number): string {
  if (!Number.isFinite(value)) {
    throw new MoneyFormatError(`Invalid money value "${String(value)}".`);
  }
  return value.toFixed(2);
}
