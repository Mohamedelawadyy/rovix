import { ar } from '@/locales/ar';

export function FieldLabel({
  htmlFor,
  label,
  optional,
  size = 'md',
}: {
  htmlFor: string;
  label: string;
  optional?: boolean | undefined;
  size?: 'sm' | 'md';
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={
        size === 'sm' ? 'text-xs font-medium text-fg-secondary' : 'text-sm font-medium text-fg'
      }
    >
      {label}
      {optional ? (
        <span className="ms-1 text-xs font-normal text-fg-muted">({ar.common.optional})</span>
      ) : null}
    </label>
  );
}

export function FieldMessages({
  id,
  error,
  hint,
}: {
  id: string;
  error?: string | undefined;
  hint?: string | undefined;
}) {
  if (error) {
    return (
      <p id={`${id}-error`} className="text-xs text-danger">
        {error}
      </p>
    );
  }
  return hint ? (
    <p id={`${id}-hint`} className="text-xs text-fg-muted">
      {hint}
    </p>
  ) : null;
}
