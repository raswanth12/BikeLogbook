import { describe, expect, it } from 'vitest';
import { ownership } from '../src/lib/calc/ownership';
import type { OdometerReading } from '../src/lib/calc/odometer';

const records = {
  fuel: [{ date: '2026-02-01', totalCost: 5000 }],
  services: [{ date: '2026-05-01', totalCost: 3000 }],
  accessories: [{ date: '2026-01-20', price: 4500 }],
  expenses: [{ date: '2026-03-01', amount: 500, category: 'toll' }],
  insurance: [{ date: '2026-01-15', amount: 9000 }],
};
const readings: OdometerReading[] = [{ source: 'fuel', id: 1, date: '2026-10-01', odometer: 8000 }];

describe('ownership', () => {
  it('adds the purchase price to everything spent since', () => {
    const o = ownership({ purchasePrice: 300000, purchaseDate: '2026-01-15', purchaseOdometer: 0 }, records, readings, '2027-01-14');
    expect(o.running.total).toBe(22000);
    expect(o.running.insurance).toBe(9000);
    expect(o.totalCost).toBe(322000);
    expect(o.km).toBe(8000);
    expect(o.days).toBe(365);
    expect(o.runningPerKm).toBe(2.75);
    expect(o.totalPerKm).toBe(40.25);
    expect(o.runningPerMonth).toBeCloseTo(22000 / (365 / 30.4375), 6); // ~1,835 a month
  });

  it('measures km from the odometer at purchase, for a used vehicle', () => {
    expect(ownership({ purchaseOdometer: 5000 }, records, readings, '2026-10-22').km).toBe(3000);
  });

  it('leaves per-km figures empty without a price or any distance', () => {
    const o = ownership({ purchaseOdometer: 0 }, { fuel: [], services: [], accessories: [], expenses: [] }, [], '2026-10-22');
    expect(o).toMatchObject({ purchasePrice: null, totalCost: 0, km: 0, runningPerKm: null, totalPerKm: null, runningPerMonth: null });
  });
});
