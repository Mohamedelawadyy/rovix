import { type ComponentProps, useId } from 'react';
import { FieldLabel, FieldMessages } from './field-parts';
import { fieldDescribedBy } from './field-utils';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<ComponentProps<'select'>, 'id'> {
  label: string;
  options: readonly SelectOption[];
  /** Adds an empty first option (e.g. "All"). */
  placeholder?: string;
  error?: string | undefined;
  hint?: string;
  optional?: boolean;
  /** Label style: `sm` for dense filter bars, `md` for forms. */
  labelSize?: 'sm' | 'md';
}

/** Native select: accessible, keyboard- and mobile-friendly out of the box. */
export function Select({
  label,
  options,
  placeholder,
  error,
  hint,
  optional,
  labelSize = 'sm',
  className = '',
  ...rest
}: SelectProps) {
  const id = useId();

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <FieldLabel htmlFor={id} label={label} optional={optional} size={labelSize} />
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy(id, error, hint)}
        className="h-10 rounded-md border border-border-strong bg-surface px-3 text-sm text-fg aria-invalid:border-danger disabled:bg-surface-muted disabled:text-fg-muted"
        {...rest}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldMessages id={id} error={error} hint={hint} />
    </div>
  );
}
