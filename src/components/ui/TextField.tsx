import { type ComponentProps, useId } from 'react';
import { FieldLabel, FieldMessages } from './field-parts';
import { fieldDescribedBy } from './field-utils';

export interface TextFieldProps extends Omit<ComponentProps<'input'>, 'id'> {
  label: string;
  /** Server or client validation message shown under the input. */
  error?: string | undefined;
  hint?: string;
  /** Shows "(optional)" next to the label. */
  optional?: boolean;
}

/** Labelled input. Works with react-hook-form's `register()` (React 19 passes `ref` as a prop). */
export function TextField({
  label,
  error,
  hint,
  optional,
  className = '',
  ...rest
}: TextFieldProps) {
  const id = useId();

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <FieldLabel htmlFor={id} label={label} optional={optional} />
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy(id, error, hint)}
        className="h-10 rounded-md border border-border-strong bg-surface px-3 text-sm text-fg placeholder:text-fg-muted aria-invalid:border-danger disabled:bg-surface-muted"
        {...rest}
      />
      <FieldMessages id={id} error={error} hint={hint} />
    </div>
  );
}
