import {
  addMoney,
  compareMoney,
  formatMoney,
  fromMinor,
  isZeroMoney,
  MoneyFormatError,
  normalizeMoney,
  subtractMoney,
  toMinor,
} from './money';

describe('money', () => {
  it('converts between decimal strings and minor units', () => {
    expect(toMinor('1250.50')).toBe(125050n);
    expect(toMinor('1250.5')).toBe(125050n);
    expect(toMinor('7')).toBe(700n);
    expect(toMinor('-0.05')).toBe(-5n);
    expect(fromMinor(125050n)).toBe('1250.50');
    expect(fromMinor(-5n)).toBe('-0.05');
    expect(fromMinor(0n)).toBe('0.00');
  });

  it('is exact where floats are not', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(addMoney('0.10', '0.20')).toBe('0.30');
    expect(addMoney('9999999999999.98', '0.01')).toBe('9999999999999.99');
  });

  it('adds, subtracts and compares', () => {
    expect(addMoney('950000.00', '-10000.00', 5000)).toBe('945000.00');
    expect(subtractMoney('940000.00', '200000.00')).toBe('740000.00');
    expect(compareMoney('10.00', '9.99')).toBe(1);
    expect(compareMoney('10', '10.00')).toBe(0);
    expect(compareMoney('1', '2')).toBe(-1);
    expect(isZeroMoney('0.00')).toBe(true);
    expect(normalizeMoney(12.5)).toBe('12.50');
  });

  it('rejects invalid input instead of guessing', () => {
    expect(() => toMinor('12.345')).toThrow(MoneyFormatError);
    expect(() => toMinor('1,000')).toThrow(MoneyFormatError);
    expect(() => toMinor('')).toThrow(MoneyFormatError);
    expect(() => toMinor(Number.NaN)).toThrow(MoneyFormatError);
  });

  it('formats for display with Latin digits', () => {
    expect(formatMoney('1250000', { locale: 'en-US', currency: 'EGP' })).toMatch(/1,250,000\.00/);
    expect(formatMoney('1250000.5', { locale: 'ar-EG', withCurrency: false })).toMatch(/[0-9]/);
    expect(formatMoney('9999999999999.99', { locale: 'en-US', withCurrency: false })).toBe(
      '9,999,999,999,999.99',
    );
  });
});
