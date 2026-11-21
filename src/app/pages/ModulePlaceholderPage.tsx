import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { ar } from '@/locales/ar';

/** Temporary page for a module in the approved scope that has not been built yet (FE-008+). */
export function ModulePlaceholderPage({ title }: { title: string }) {
  useDocumentTitle(title);

  return (
    <section>
      <h1 className="text-2xl font-semibold text-fg">{title}</h1>
      <div className="mt-6 rounded-lg border border-dashed border-border-strong bg-surface p-8 text-center text-fg-muted">
        {ar.layout.underConstruction}
      </div>
    </section>
  );
}
