import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form';
import { isApiError } from '@/lib/api';

/**
 * Puts Laravel 422 messages on the matching form fields (dot paths like `vehicles.0.vin` are
 * react-hook-form paths too). Returns messages that have no field in the form, so the caller can
 * show them in a form-level alert instead of silently dropping them.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly string[],
): string[] {
  if (!isApiError(error) || error.kind !== 'validation') return [];

  const unmatched: string[] = [];
  let focused = false;

  for (const [path, messages] of Object.entries(error.fieldErrors)) {
    const message = messages[0];
    if (!message) continue;

    const root = path.split('.')[0] ?? path;
    if (fields.includes(path) || fields.includes(root)) {
      // Nested keys we don't render individually (e.g. specifications.<key>) go on the root field.
      const target = (fields.includes(path) ? path : root) as FieldPath<T>;
      setError(target, { type: 'server', message }, { shouldFocus: !focused });
      focused = true;
    } else {
      unmatched.push(message);
    }
  }
  return unmatched;
}
