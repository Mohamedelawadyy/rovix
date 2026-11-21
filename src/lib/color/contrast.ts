/**
 * WCAG 2.2 contrast utilities for 6-digit hex colors (#rrggbb).
 * https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
 */

const HEX_PATTERN = /^#([0-9a-f]{6})$/i;

function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const match = HEX_PATTERN.exec(hex.trim());
  if (!match?.[1]) {
    throw new TypeError(`Expected a #rrggbb color, got "${hex}".`);
  }

  const value = parseInt(match[1], 16);
  const r = channelToLinear((value >> 16) & 0xff);
  const g = channelToLinear((value >> 8) & 0xff);
  const b = channelToLinear(value & 0xff);

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two colors, from 1 (none) to 21 (black on white). */
export function contrastRatio(foreground: string, background: string): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [lighter, darker] = a > b ? [a, b] : [b, a];

  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA minimums: 4.5 for normal text, 3 for large text and non-text UI (icons, borders, focus). */
export const WCAG_AA = { text: 4.5, largeText: 3, nonText: 3 } as const;
