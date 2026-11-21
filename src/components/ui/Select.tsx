import { type SelectHTMLAttributes, useId } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  options: readonly SelectOption[];
  /** Adds an empty first option (e.g. "All"). */
  placeholder?: string;
}

/** Native select: accessible, keyboard- and mobile-friendly out of the box. */
export function Select({ label, options, placeholder, className = '', ...rest }: SelectProps) {
  const id = useId();

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-xs font-medium text-fg-secondary">
        {label}
      </label>
      <select
        id={id}
        className="h-10 rounded-md border border-border-strong bg-surface px-3 text-sm text-fg disabled:bg-surface-muted disabled:text-fg-muted"
        {...rest}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
