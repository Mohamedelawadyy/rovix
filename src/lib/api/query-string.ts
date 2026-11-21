import type { QueryParams, QueryValue } from './types';

function isPresent(value: QueryValue): value is string | number | boolean {
  return value !== null && value !== undefined && value !== '';
}

function serialize(value: string | number | boolean): string {
  // Laravel's boolean validation and `$request->boolean()` accept 1/0.
  return typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
}

function joinList(values: readonly QueryValue[]): string | null {
  const present = values.filter(isPresent).map(serialize);
  return present.length > 0 ? present.join(',') : null;
}

/**
 * Builds a Laravel-compatible query string.
 * - `{ search: 'x', page: 2 }` → `search=x&page=2`
 * - `{ filter: { status: ['a', 'b'] } }` → `filter[status]=a,b`
 * Empty values are skipped so callers can pass optional state as-is.
 */
export function buildQueryString(params: QueryParams | undefined): string {
  if (!params) return '';

  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      const joined = joinList(value as readonly QueryValue[]);
      if (joined !== null) search.append(key, joined);
      continue;
    }

    if (value !== null && typeof value === 'object') {
      for (const [nestedKey, nestedValue] of Object.entries(value)) {
        const serialized = Array.isArray(nestedValue)
          ? joinList(nestedValue as readonly QueryValue[])
          : isPresent(nestedValue as QueryValue)
            ? serialize(nestedValue as string | number | boolean)
            : null;
        if (serialized !== null) search.append(`${key}[${nestedKey}]`, serialized);
      }
      continue;
    }

    if (isPresent(value)) search.append(key, serialize(value));
  }

  const result = search.toString();
  return result ? `?${result}` : '';
}
