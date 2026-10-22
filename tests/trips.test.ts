import { describe, expect, it } from 'vitest';
import { tripDistance, tripTotals } from '../src/lib/calc/trips';

describe('trips', () => {
  it('measures distance from the odometer readings', () => {
    expect(tripDistance({ startOdometer: 12000, endOdometer: 12345 })).toBe(345);
  });

  it('never returns a negative distance', () => {
    expect(tripDistance({ startOdometer: 12000, endOdometer: 11990 })).toBe(0);
  });

  it('totals trips, including none', () => {
    expect(tripTotals([])).toEqual({ count: 0, distance: 0 });
    expect(
      tripTotals([
        { startOdometer: 100, endOdometer: 150 },
        { startOdometer: 150, endOdometer: 400 },
      ]),
    ).toEqual({ count: 2, distance: 300 });
  });
});
