import { describe, expect, it } from 'vitest';
import { priceFrom, totalFrom } from '../src/lib/calc/fuel';
import { checkOdometer, latestOdometer, type OdometerReading } from '../src/lib/calc/odometer';
import { parseDecimal } from '../src/lib/format';

describe('fuel totals', () => {
  it('rounds the total to two decimals', () => {
    expect(totalFrom(5.37, 104.21)).toBe(559.61);
  });

  it('recalculates price from an edited total', () => {
    expect(priceFrom(500, 4.8)).toBe(104.167);
    expect(priceFrom(500, 0)).toBe(0);
  });
});

describe('parseDecimal', () => {
  it('accepts dots and commas', () => {
    expect(parseDecimal('12.5')).toBe(12.5);
    expect(parseDecimal('12,5')).toBe(12.5);
    expect(parseDecimal(' 7 ')).toBe(7);
  });

  it('rejects empty and invalid input', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('.')).toBeNull();
    expect(parseDecimal('12a')).toBeNull();
    expect(parseDecimal('-3')).toBeNull();
  });
});

describe('odometer checks', () => {
  const readings: OdometerReading[] = [
    { source: 'fuel', id: 1, date: '2026-01-01', odometer: 1000 },
    { source: 'fuel', id: 2, date: '2026-02-01', odometer: 1500 },
  ];

  it('finds the latest reading', () => {
    expect(latestOdometer([])).toBeNull();
    expect(latestOdometer(readings)).toBe(1500);
  });

  it('warns when a new reading is below the previous one', () => {
    expect(checkOdometer(readings, '2026-03-01', 1400).ok).toBe(false);
    expect(checkOdometer(readings, '2026-03-01', 1500).ok).toBe(true);
  });

  it('only compares against readings on or before the date', () => {
    expect(checkOdometer(readings, '2026-01-15', 1200).ok).toBe(true);
  });

  it('ignores the record being edited', () => {
    expect(checkOdometer(readings, '2026-02-01', 1450, { source: 'fuel', id: 2 }).ok).toBe(true);
  });

  it('passes with no earlier readings', () => {
    expect(checkOdometer([], '2026-01-01', 0).ok).toBe(true);
  });
});
