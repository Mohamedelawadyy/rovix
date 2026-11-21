import { contrastRatio, relativeLuminance } from './contrast';

describe('contrast', () => {
  it('computes the WCAG extremes', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBe(1);
    expect(contrastRatio('#000000', '#ffffff')).toBe(21);
    expect(contrastRatio('#777777', '#777777')).toBe(1);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#c81e24', '#ffffff')).toBeCloseTo(contrastRatio('#ffffff', '#c81e24'));
  });

  it('matches a known reference value', () => {
    // #767676 on white is the classic 4.54:1 AA boundary gray.
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });

  it('rejects non #rrggbb input', () => {
    expect(() => relativeLuminance('red')).toThrow(TypeError);
    expect(() => relativeLuminance('#fff')).toThrow(TypeError);
  });
});
