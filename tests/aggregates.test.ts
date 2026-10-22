import { describe, expect, it } from 'vitest';
import { monthBounds, spendBetween, type SpendRecords } from '../src/lib/calc/aggregates';

describe('monthBounds', () => {
  it('handles month lengths and leap years', () => {
    expect(monthBounds('2026-10-22')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(monthBounds('2026-02-10')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthBounds('2028-02-10')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(monthBounds('2026-12-05')).toEqual({ start: '2026-12-01', end: '2026-12-31' });
  });
});

describe('spendBetween', () => {
  const empty: SpendRecords = { fuel: [], services: [], accessories: [], expenses: [] };

  it('returns zeros with no data', () => {
    expect(spendBetween(empty, '2026-10-01', '2026-10-31')).toEqual({ fuel: 0, service: 0, accessories: 0, other: 0, insurance: 0, total: 0 });
  });

  it('sums each category inside the range, with inclusive ends', () => {
    const records: SpendRecords = {
      fuel: [
        { date: '2026-09-30', totalCost: 999 },
        { date: '2026-10-01', totalCost: 500 },
        { date: '2026-10-31', totalCost: 300 },
      ],
      services: [{ date: '2026-10-15', totalCost: 2000 }],
      accessories: [{ date: '2026-11-01', price: 4000 }],
      expenses: [
        { date: '2026-10-10', amount: 20 },
        { date: '2026-10-11', amount: 30 },
      ],
    };
    expect(spendBetween(records, '2026-10-01', '2026-10-31')).toEqual({
      fuel: 800,
      service: 2000,
      accessories: 0,
      other: 50,
      insurance: 0,
      total: 2850,
    });
  });

  it('puts insurance premiums and insurance expenses in their own bucket', () => {
    const records: SpendRecords = {
      fuel: [],
      services: [],
      accessories: [],
      expenses: [
        { date: '2026-10-02', amount: 40, category: 'parking' },
        { date: '2026-10-03', amount: 300, category: 'insurance' },
      ],
      insurance: [{ date: '2026-10-15', amount: 9200 }],
    };
    expect(spendBetween(records, '2026-10-01', '2026-10-31')).toMatchObject({ other: 40, insurance: 9500, total: 9540 });
  });
});
