import tokensCss from './tokens.css?raw';
import { contrastRatio, WCAG_AA } from '@/lib/color/contrast';

/** Resolves a custom property from tokens.css, following var(--x) references to a hex value. */
function resolveToken(name: string, seen = new Set<string>()): string {
  if (seen.has(name)) {
    throw new Error(`Circular token reference: ${[...seen, name].join(' -> ')}`);
  }
  seen.add(name);

  const match = new RegExp(`${name}:\\s*([^;]+);`).exec(tokensCss);
  const value = match?.[1]?.trim();
  if (!value) {
    throw new Error(`Token ${name} is not defined in tokens.css`);
  }

  const reference = /^var\((--[\w-]+)\)$/.exec(value);
  return reference?.[1] ? resolveToken(reference[1], seen) : value;
}

describe('brand tokens', () => {
  it('keeps the measured logo colors', () => {
    expect(resolveToken('--ui-color-accent')).toBe('#c81e24');
    expect(resolveToken('--red-900')).toBe('#6d1518');
    expect(resolveToken('--ink-950')).toBe('#0a0a0a');
  });

  const textPairs: [foreground: string, background: string][] = [
    ['--ui-color-text', '--ui-color-canvas'],
    ['--ui-color-text', '--ui-color-surface'],
    ['--ui-color-text-secondary', '--ui-color-surface'],
    ['--ui-color-text-muted', '--ui-color-surface'],
    ['--ui-color-text-muted', '--ui-color-canvas'],
    ['--ui-color-on-primary', '--ui-color-primary'],
    ['--ui-color-on-primary', '--ui-color-primary-hover'],
    ['--ui-color-on-accent', '--ui-color-accent'],
    ['--ui-color-on-accent', '--ui-color-accent-hover'],
    ['--ui-color-accent', '--ui-color-surface'],
    ['--ui-color-text-inverse', '--ui-color-sidebar'],
    ['--ui-color-text-on-sidebar', '--ui-color-sidebar'],
    ['--ui-color-accent-on-dark', '--ui-color-sidebar'],
    ['--ui-color-success', '--ui-color-surface'],
    ['--ui-color-warning', '--ui-color-surface'],
    ['--ui-color-danger', '--ui-color-surface'],
    ['--ui-color-info', '--ui-color-surface'],
    ['--ui-color-success-strong', '--ui-color-success-subtle'],
    ['--ui-color-warning-strong', '--ui-color-warning-subtle'],
    ['--ui-color-danger-strong', '--ui-color-danger-subtle'],
    ['--ui-color-info-strong', '--ui-color-info-subtle'],
    ['--ui-color-text', '--ui-color-accent-subtle'],
  ];

  it.each(textPairs)('%s on %s meets AA for normal text', (foreground, background) => {
    const ratio = contrastRatio(resolveToken(foreground), resolveToken(background));
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA.text);
  });

  it.each([
    ['--ui-color-focus-ring', '--ui-color-surface'],
    ['--ui-color-focus-ring', '--ui-color-canvas'],
    ['--ui-color-border-strong', '--ui-color-sidebar'],
  ])('%s on %s meets AA for non-text UI', (foreground, background) => {
    const ratio = contrastRatio(resolveToken(foreground), resolveToken(background));
    expect(ratio).toBeGreaterThanOrEqual(WCAG_AA.nonText);
  });
});
