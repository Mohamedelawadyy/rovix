/**
 * Minimal inline icon set (24px grid, stroke-based) so we don't need an icon dependency yet.
 * Icons are decorative by default; give the surrounding control an accessible name.
 */
const PATHS = {
  dashboard: 'M4 4h6v8H4zM14 4h6v5h-6zM14 13h6v7h-6zM4 16h6v4H4z',
  car: 'M5 16h14M3 16v-3l2-5h14l2 5v3h-2M7 16v2M17 16v2M6.5 12.5h.01M17.5 12.5h.01M3 13h18',
  users:
    'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6',
  contract: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  bookmark: 'M7 3h10v18l-5-4-5 4z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6L6 18',
  logout:
    'M14 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3M10 12h11M18 9l3 3-3 3',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 20,
  className = '',
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
