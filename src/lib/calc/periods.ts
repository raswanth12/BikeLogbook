import { spendBetween, type SpendRecords, type SpendSplit } from './aggregates';
import { computeMileage, sortFills, type FuelFill, type MileageResult } from './mileage';
import type { OdometerReading } from './odometer';
import { tripTotals } from './trips';

export type PeriodKind = 'week' | 'month' | 'year';

// Dates are 'YYYY-MM-DD' strings. Date math goes through UTC so time zones can't shift a day.
const toUTC = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fromUTC = (d: Date) => d.toISOString().slice(0, 10);

/** First and last day of the week (Monday to Sunday), month or year containing `anchor`. */
export function periodRange(kind: PeriodKind, anchor: string): { start: string; end: string } {
  const d = toUTC(anchor);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (kind === 'year') return { start: `${y}-01-01`, end: `${y}-12-31` };
  if (kind === 'month') return { start: fromUTC(new Date(Date.UTC(y, m, 1))), end: fromUTC(new Date(Date.UTC(y, m + 1, 0))) };
  const sinceMonday = (d.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(y, m, d.getUTCDate() - sinceMonday));
  const end = new Date(Date.UTC(y, m, d.getUTCDate() - sinceMonday + 6));
  return { start: fromUTC(start), end: fromUTC(end) };
}

/** Moves the anchor by whole periods. Lands on the period's first day, so months never overflow. */
export function shiftPeriod(kind: PeriodKind, anchor: string, delta: number): string {
  const { start } = periodRange(kind, anchor);
  const d = toUTC(start);
  if (kind === 'week') d.setUTCDate(d.getUTCDate() + 7 * delta);
  else if (kind === 'month') d.setUTCMonth(d.getUTCMonth() + delta);
  else d.setUTCFullYear(d.getUTCFullYear() + delta);
  return fromUTC(d);
}

export interface ReportInput extends SpendRecords {
  fuel: (FuelFill & { date: string })[];
  trips: { date: string; startOdometer: number; endOdometer: number }[];
  readings: OdometerReading[];
}

export interface DatedMileage extends MileageResult {
  date: string;
}

export interface PeriodReport {
  km: number;
  tripCount: number;
  tripKm: number;
  fillCount: number;
  litres: number;
  fuelSpend: number;
  /** Fuel-weighted average of the full-tank intervals that closed in this period. */
  kmPerLitre: number | null;
  spend: SpendSplit;
  costPerKm: number | null;
  fuelCostPerKm: number | null;
  best: DatedMileage | null;
  worst: DatedMileage | null;
  mileage: DatedMileage[];
}

/**
 * Distance ridden in a period: highest reading inside it minus the last reading before it.
 * With no earlier reading (the very first period) it starts from the first reading inside.
 */
export function kmInPeriod(readings: OdometerReading[], start: string, end: string): number {
  const inside = readings.filter((r) => r.date >= start && r.date <= end);
  if (inside.length === 0) return 0;
  const before = readings.filter((r) => r.date < start);
  const top = Math.max(...inside.map((r) => r.odometer));
  const baseline = before.length ? Math.max(...before.map((r) => r.odometer)) : Math.min(...inside.map((r) => r.odometer));
  return Math.max(0, top - baseline);
}

export function buildReport(input: ReportInput, start: string, end: string): PeriodReport {
  const inRange = (d: string) => d >= start && d <= end;
  const fills = input.fuel.filter((f) => inRange(f.date));
  const trips = tripTotals(input.trips.filter((t) => inRange(t.date)));

  // Mileage is worked out over all fills, so an interval that starts before the period still counts.
  const all = computeMileage(input.fuel);
  const mileage = sortFills(input.fuel)
    .filter((f) => inRange(f.date) && all.has(f.id))
    .map((f) => ({ ...all.get(f.id)!, date: f.date }));

  const mDistance = mileage.reduce((s, r) => s + r.distance, 0);
  const mLitres = mileage.reduce((s, r) => s + r.litres, 0);
  const mCost = mileage.reduce((s, r) => s + r.cost, 0);
  const byKmpl = [...mileage].sort((a, b) => b.kmPerLitre - a.kmPerLitre);

  const km = kmInPeriod(input.readings, start, end);
  const spend = spendBetween(input, start, end);

  return {
    km,
    tripCount: trips.count,
    tripKm: trips.distance,
    fillCount: fills.length,
    litres: fills.reduce((s, f) => s + f.litres, 0),
    fuelSpend: spend.fuel,
    kmPerLitre: mLitres > 0 ? mDistance / mLitres : null,
    spend,
    costPerKm: km > 0 ? spend.total / km : null,
    fuelCostPerKm: mDistance > 0 ? mCost / mDistance : null,
    best: byKmpl[0] ?? null,
    worst: byKmpl.length > 1 ? byKmpl[byKmpl.length - 1] : null,
    mileage,
  };
}

/** Spend split for each month of a year, January first. */
export function monthlySpend(input: SpendRecords, year: number): (SpendSplit & { month: number })[] {
  return Array.from({ length: 12 }, (_, i) => {
    const { start, end } = periodRange('month', `${year}-${String(i + 1).padStart(2, '0')}-01`);
    return { month: i + 1, ...spendBetween(input, start, end) };
  });
}
