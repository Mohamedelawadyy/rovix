import type { ReactNode } from 'react';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

/** Centered message for 403 / 404 / errors / empty states. */
export function StatusPage({
  code,
  title,
  body,
  actions,
}: {
  code?: string;
  title: string;
  body: string;
  actions?: ReactNode;
}) {
  useDocumentTitle(title);

  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
      {code ? <p className="text-5xl font-bold text-accent">{code}</p> : null}
      <h1 className="text-xl font-semibold text-fg">{title}</h1>
      <p className="text-fg-muted">{body}</p>
      {actions ? <div className="mt-2 flex gap-2">{actions}</div> : null}
    </section>
  );
}
