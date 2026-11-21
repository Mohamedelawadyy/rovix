import { type ComponentProps, useId } from 'react';
import { FieldLabel, FieldMessages } from './field-parts';
import { fieldDescribedBy } from './field-utils';

export interface TextAreaProps extends Omit<ComponentProps<'textarea'>, 'id'> {
  label: string;
  error?: string | undefined;
  hint?: string;
  optional?: boolean;
}

export function TextArea({ label, error, hint, optional, className = '', ...rest }: TextAreaProps) {
  const id = useId();

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <FieldLabel htmlFor={id} label={label} optional={optional} />
      <textarea
        id={id}
        rows={4}
        aria-invalid={error ? true : undefined}
        aria-describedby={fieldDescribedBy(id, error, hint)}
        className="rounded-md border border-border-strong bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted aria-invalid:border-danger"
        {...rest}
      />
      <FieldMessages id={id} error={error} hint={hint} />
    </div>
  );
}
