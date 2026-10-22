import { describe, expect, it } from 'vitest';
import { computeMileage, mileageSeries, summarizeMileage, type FuelFill } from '../src/lib/calc/mileage';

let nextId = 1;
function fill(odometer: number, litres: number, isFullTank = true, date = '2026-01-01', totalCost = litres * 100): FuelFill {
  return { id: nextId++, date, odometer, litres, totalCost, isFullTank };
}

describe('computeMileage', () => {
  it('returns nothing for no data', () => {
    expect(computeMileage([]).size).toBe(0);
  });

  it('returns nothing for a single fill', () => {
    expect(computeMileage([fill(1000, 10)]).size).toBe(0);
  });

  it('measures between two full fills, ignoring the first fill litres', () => {
    const a = fill(1000, 12);
    const b = fill(1400, 10);
    const r = computeMileage([a, b]).get(b.id)!;
    expect(r.distance).toBe(400);
    expect(r.litres).toBe(10);
    expect(r.kmPerLitre).toBe(40);
    expect(computeMileage([a, b]).has(a.id)).toBe(false);
  });

  it('adds partial fills in between to the next full fill', () => {
    const a = fill(1000, 12);
    const p = fill(1200, 3, false);
    const b = fill(1500, 7);
    const map = computeMileage([a, p, b]);
    expect(map.has(p.id)).toBe(false);
    const r = map.get(b.id)!;
    expect(r.litres).toBe(10);
    expect(r.kmPerLitre).toBe(50);
    expect(r.cost).toBe(1000);
    expect(r.costPerKm).toBe(2);
  });

  it('ignores partial fills before the first full fill', () => {
    const p = fill(900, 4, false);
    const a = fill(1000, 12);
    const b = fill(1300, 10);
    expect(computeMileage([p, a, b]).get(b.id)!.litres).toBe(10);
  });

  it('gives no mileage when only partial fills come after a full fill', () => {
    const a = fill(1000, 12);
    const p = fill(1200, 3, false);
    expect(computeMileage([a, p]).size).toBe(0);
  });

  it('orders by odometer, so input order and same-day fills do not matter', () => {
    const a = fill(1000, 12, true, '2026-03-01');
    const p = fill(1150, 2, false, '2026-03-02');
    const b = fill(1300, 8, true, '2026-03-02');
    const r = computeMileage([b, p, a]).get(b.id)!;
    expect(r.distance).toBe(300);
    expect(r.litres).toBe(10);
  });

  it('treats a full top-up at the same odometer as the new starting point', () => {
    const a = fill(1000, 12);
    const top = fill(1000, 0.5);
    const b = fill(1400, 10);
    const map = computeMileage([a, top, b]);
    expect(map.has(top.id)).toBe(false);
    expect(map.get(b.id)!.kmPerLitre).toBe(40);
  });

  it('still computes across a large odometer gap', () => {
    const a = fill(1000, 10);
    const b = fill(5000, 10);
    expect(computeMileage([a, b]).get(b.id)!.kmPerLitre).toBe(400);
  });
});

describe('summarizeMileage', () => {
  it('returns nulls with no results', () => {
    expect(summarizeMileage([])).toEqual({ overallKmPerLitre: null, last5KmPerLitre: null, overallCostPerKm: null });
  });

  it('weights averages by fuel and limits last 5 to the most recent intervals', () => {
    // 7 full fills: six intervals. The first is 50 km/l, the rest 40 km/l.
    const fills = [fill(0, 10), fill(500, 10), fill(900, 10), fill(1300, 10), fill(1700, 10), fill(2100, 10), fill(2500, 10)];
    const s = summarizeMileage(mileageSeries(fills));
    expect(s.overallKmPerLitre).toBeCloseTo(2500 / 60);
    expect(s.last5KmPerLitre).toBe(40);
    expect(s.overallCostPerKm).toBeCloseTo(6000 / 2500);
  });
});

import { mileageByCondition } from '../src/lib/calc/mileage';

describe('mileageByCondition', () => {
  it('groups intervals by the conditions on the closing fill', () => {
    const fills = [
      { id: 101, date: '2026-01-01', odometer: 0, litres: 10, totalCost: 1000, isFullTank: true },
      { id: 102, date: '2026-01-05', odometer: 300, litres: 10, totalCost: 1000, isFullTank: true, conditions: ['city'] },
      { id: 103, date: '2026-01-09', odometer: 750, litres: 10, totalCost: 1000, isFullTank: true, conditions: ['highway'] },
      { id: 104, date: '2026-01-13', odometer: 1150, litres: 10, totalCost: 1000, isFullTank: true, conditions: ['city', 'highway'] },
      { id: 105, date: '2026-01-15', odometer: 1300, litres: 5, totalCost: 500, isFullTank: false, conditions: ['offroad'] },
    ];
    const out = mileageByCondition(fills);
    expect(out.map((c) => c.condition)).toEqual(['highway', 'city']);
    expect(out[0]).toMatchObject({ fills: 2, distance: 850, litres: 20 });
    expect(out[1].kmPerLitre).toBe(700 / 20);
  });

  it('is empty when no fills are tagged', () => {
    expect(mileageByCondition([])).toEqual([]);
  });
});
