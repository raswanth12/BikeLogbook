import { describe, expect, it } from 'vitest';
import { buildReport, kmInPeriod, monthlySpend, periodRange, shiftPeriod, type ReportInput } from '../src/lib/calc/periods';
import type { OdometerReading } from '../src/lib/calc/odometer';

describe('periodRange', () => {
  it('runs weeks Monday to Sunday, across month and year ends', () => {
    expect(periodRange('week', '2026-10-22')).toEqual({ start: '2026-10-19', end: '2026-10-25' }); // a Thursday
    expect(periodRange('week', '2026-10-19')).toEqual({ start: '2026-10-19', end: '2026-10-25' }); // Monday
    expect(periodRange('week', '2026-10-25')).toEqual({ start: '2026-10-19', end: '2026-10-25' }); // Sunday
    expect(periodRange('week', '2027-01-01')).toEqual({ start: '2026-12-28', end: '2027-01-03' });
  });

  it('covers whole months and years', () => {
    expect(periodRange('month', '2028-02-15')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(periodRange('year', '2026-06-30')).toEqual({ start: '2026-01-01', end: '2026-12-31' });
  });
});

describe('shiftPeriod', () => {
  it('moves by whole periods without month overflow', () => {
    expect(shiftPeriod('month', '2026-01-31', 1)).toBe('2026-02-01');
    expect(shiftPeriod('month', '2026-01-15', -1)).toBe('2025-12-01');
    expect(shiftPeriod('week', '2026-10-22', 1)).toBe('2026-10-26');
    expect(shiftPeriod('year', '2026-10-22', -1)).toBe('2025-01-01');
  });
});

const r = (date: string, odometer: number, source: OdometerReading['source'] = 'fuel', id = 0): OdometerReading => ({ source, id, date, odometer });

describe('kmInPeriod', () => {
  it('is zero with no readings in the period', () => {
    expect(kmInPeriod([], '2026-10-01', '2026-10-31')).toBe(0);
    expect(kmInPeriod([r('2026-09-30', 1000)], '2026-10-01', '2026-10-31')).toBe(0);
  });

  it('measures from the last reading before the period', () => {
    const readings = [r('2026-09-28', 1000), r('2026-10-05', 1200), r('2026-10-20', 1500, 'trip'), r('2026-11-02', 1700)];
    expect(kmInPeriod(readings, '2026-10-01', '2026-10-31')).toBe(500);
  });

  it('starts from the first reading inside when nothing came before', () => {
    expect(kmInPeriod([r('2026-10-05', 1200), r('2026-10-20', 1500)], '2026-10-01', '2026-10-31')).toBe(300);
  });
});

describe('buildReport', () => {
  const input: ReportInput = {
    fuel: [
      { id: 1, date: '2026-09-28', odometer: 1000, litres: 10, totalCost: 1000, isFullTank: true },
      { id: 2, date: '2026-10-05', odometer: 1300, litres: 10, totalCost: 1050, isFullTank: true },
      { id: 3, date: '2026-10-12', odometer: 1450, litres: 4, totalCost: 420, isFullTank: false },
      { id: 4, date: '2026-10-20', odometer: 1700, litres: 6, totalCost: 630, isFullTank: true },
    ],
    trips: [{ date: '2026-10-18', startOdometer: 1500, endOdometer: 1650 }],
    services: [{ date: '2026-10-10', totalCost: 2000 }],
    accessories: [{ date: '2026-09-01', price: 4500 }],
    expenses: [{ date: '2026-10-11', amount: 100 }],
    readings: [r('2026-09-28', 1000), r('2026-10-05', 1300), r('2026-10-12', 1450), r('2026-10-20', 1700), r('2026-10-18', 1650, 'trip')],
  };

  it('returns empty figures for a period with nothing in it', () => {
    const rep = buildReport(input, '2026-12-01', '2026-12-31');
    expect(rep).toMatchObject({ km: 0, fillCount: 0, litres: 0, kmPerLitre: null, costPerKm: null, best: null, worst: null, tripCount: 0 });
  });

  it('adds up a month', () => {
    const rep = buildReport(input, '2026-10-01', '2026-10-31');
    expect(rep.km).toBe(700);
    expect(rep.fillCount).toBe(3);
    expect(rep.litres).toBe(20);
    expect(rep.fuelSpend).toBe(2100);
    expect(rep.tripCount).toBe(1);
    expect(rep.tripKm).toBe(150);
    expect(rep.spend).toEqual({ fuel: 2100, service: 2000, accessories: 0, other: 100, insurance: 0, total: 4200 });
    expect(rep.costPerKm).toBe(6);
  });

  it('counts mileage for intervals that close in the period, including one that started before it', () => {
    const rep = buildReport(input, '2026-10-01', '2026-10-31');
    // Fill 2: 300 km on 10 L = 30. Fill 4: 400 km on 4 + 6 L = 40.
    expect(rep.mileage.map((m) => m.id)).toEqual([2, 4]);
    expect(rep.kmPerLitre).toBe(700 / 20);
    expect(rep.best!.id).toBe(4);
    expect(rep.worst!.id).toBe(2);
    expect(rep.fuelCostPerKm).toBe((1050 + 420 + 630) / 700);
  });

  it('has no worst fill when only one interval closed', () => {
    const rep = buildReport(input, '2026-10-01', '2026-10-07');
    expect(rep.best!.id).toBe(2);
    expect(rep.worst).toBeNull();
  });
});

describe('monthlySpend', () => {
  it('splits a year into twelve months', () => {
    const months = monthlySpend({ fuel: [{ date: '2026-03-04', totalCost: 500 }], services: [], accessories: [{ date: '2026-12-31', price: 900 }], expenses: [] }, 2026);
    expect(months).toHaveLength(12);
    expect(months[2]).toMatchObject({ month: 3, fuel: 500, total: 500 });
    expect(months[11]).toMatchObject({ month: 12, accessories: 900 });
    expect(months[0].total).toBe(0);
  });
});
