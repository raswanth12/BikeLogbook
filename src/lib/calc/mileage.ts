export interface FuelFill {
  id: number;
  date: string;
  odometer: number;
  litres: number;
  totalCost: number;
  isFullTank: boolean;
}

/** Mileage for one full-tank fill, measured from the previous full-tank fill. */
export interface MileageResult {
  id: number;
  distance: number;
  litres: number;
  cost: number;
  kmPerLitre: number;
  costPerKm: number;
}

export interface MileageSummary {
  overallKmPerLitre: number | null;
  last5KmPerLitre: number | null;
  overallCostPerKm: number | null;
}

/** Odometer first, so several fills on one day keep the order they happened in. */
export function sortFills<T extends FuelFill>(fills: T[]): T[] {
  return [...fills].sort((a, b) => a.odometer - b.odometer || a.date.localeCompare(b.date) || a.id - b.id);
}

/**
 * Full-tank method. For each full fill after the first, distance is the odometer gap to the
 * previous full fill, and fuel is everything poured in since then (partials included), not
 * counting the previous full fill itself. Partial fills never get a mileage of their own.
 */
export function computeMileage(fills: FuelFill[]): Map<number, MileageResult> {
  const results = new Map<number, MileageResult>();
  let lastFull: FuelFill | null = null;
  let litres = 0;
  let cost = 0;

  for (const fill of sortFills(fills)) {
    if (lastFull) {
      litres += fill.litres;
      cost += fill.totalCost;
    }
    if (!fill.isFullTank) continue;

    if (lastFull) {
      const distance = fill.odometer - lastFull.odometer;
      // Zero distance means a top-up at the same reading: there is nothing to measure.
      if (distance > 0 && litres > 0) {
        results.set(fill.id, {
          id: fill.id,
          distance,
          litres,
          cost,
          kmPerLitre: distance / litres,
          costPerKm: cost / distance,
        });
      }
    }
    lastFull = fill;
    litres = 0;
    cost = 0;
  }
  return results;
}

/**
 * Averages weight each interval by its fuel, so long intervals count for more than short ones.
 * `ordered` must be in odometer order (use mileageSeries).
 */
export function summarizeMileage(ordered: MileageResult[]): MileageSummary {
  const weighted = (list: MileageResult[]) => {
    const distance = list.reduce((s, r) => s + r.distance, 0);
    const litres = list.reduce((s, r) => s + r.litres, 0);
    return litres > 0 ? distance / litres : null;
  };
  const distance = ordered.reduce((s, r) => s + r.distance, 0);
  const cost = ordered.reduce((s, r) => s + r.cost, 0);
  return {
    overallKmPerLitre: weighted(ordered),
    last5KmPerLitre: weighted(ordered.slice(-5)),
    overallCostPerKm: distance > 0 ? cost / distance : null,
  };
}

/** Results in odometer order, ready for summarizeMileage or a trend chart. */
export function mileageSeries(fills: FuelFill[]): MileageResult[] {
  const map = computeMileage(fills);
  return sortFills(fills)
    .map((f) => map.get(f.id))
    .filter((r): r is MileageResult => r !== undefined);
}

export interface ConditionMileage {
  condition: string;
  fills: number;
  distance: number;
  litres: number;
  kmPerLitre: number;
}

/**
 * Mileage split by riding condition. Each full-tank interval counts under the conditions
 * marked on the fill that closed it; one marked "city, highway" counts under both.
 */
export function mileageByCondition(fills: (FuelFill & { conditions?: string[] })[]): ConditionMileage[] {
  const results = computeMileage(fills);
  const totals = new Map<string, { fills: number; distance: number; litres: number }>();
  for (const f of fills) {
    const r = results.get(f.id);
    if (!r || !f.conditions?.length) continue;
    for (const c of f.conditions) {
      const t = totals.get(c) ?? { fills: 0, distance: 0, litres: 0 };
      t.fills++;
      t.distance += r.distance;
      t.litres += r.litres;
      totals.set(c, t);
    }
  }
  return [...totals.entries()]
    .map(([condition, t]) => ({ condition, ...t, kmPerLitre: t.distance / t.litres }))
    .sort((a, b) => b.kmPerLitre - a.kmPerLitre);
}
