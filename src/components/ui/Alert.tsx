import type { ReactNode } from 'react';

type Tone = 'danger' | 'success' | 'info' | 'warning';

const TONES: Record<Tone, string> = {
  danger: 'bg-danger-subtle text-danger-strong',
  success: 'bg-success-subtle text-success-strong',
  info: 'bg-info-subtle text-info-strong',
  warning: 'bg-warning-subtle text-warning-strong',
};

export function Alert({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  // Errors interrupt (alert); confirmations are announced politely (status).
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`rounded-md px-3 py-2.5 text-sm ${TONES[tone]}`}
    >
      {children}
    </div>
  );
}
