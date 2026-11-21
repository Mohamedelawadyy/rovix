import type { ReactNode } from 'react';

export interface DetailItem {
  label: string;
  value: ReactNode;
  /** Render left-to-right (codes, VINs, numbers) inside the RTL layout. */
  ltr?: boolean;
}

/** Label/value pairs as a description list (screen readers announce the pairing). */
export function DetailList({ items }: { items: DetailItem[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5">
          <dt className="text-xs text-fg-muted">{item.label}</dt>
          <dd className="text-sm font-medium text-fg" dir={item.ltr ? 'ltr' : undefined}>
            {item.ltr ? <span className="inline-block">{item.value}</span> : item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Card({
  title,
  children,
  className = '',
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-border bg-surface p-5 ${className}`}>
      <h2 className="mb-4 text-base font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}
