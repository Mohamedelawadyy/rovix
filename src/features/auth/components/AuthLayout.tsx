import type { ReactNode } from 'react';
import { BrandLogo } from '@/components/shared/BrandLogo';

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-4 text-center">
          <BrandLogo height={44} />
          <div>
            <h1 className="text-xl font-semibold text-fg">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-fg-muted">{subtitle}</p> : null}
          </div>
        </div>
        {children}
      </div>
    </main>
  );
}
