import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover',
  accent: 'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'border border-border-strong bg-surface text-fg hover:bg-surface-muted',
  ghost: 'bg-transparent text-fg-secondary hover:bg-surface-muted',
  danger: 'border border-danger bg-surface text-danger hover:bg-danger-subtle',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Shows the busy label and blocks repeated submits without disabling focus. */
  loading?: boolean;
  loadingLabel?: string;
  fullWidth?: boolean;
}

export function Button({
  variant = 'secondary',
  loading = false,
  loadingLabel,
  fullWidth = false,
  type = 'button',
  className = '',
  children,
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      aria-busy={loading || undefined}
      onClick={(event) => {
        if (loading) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 aria-busy:cursor-progress ${fullWidth ? 'w-full' : ''} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  );
}
