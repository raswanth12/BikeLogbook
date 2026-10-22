import { spendBetween, type SpendRecords, type SpendSplit } from './aggregates';
import type { OdometerReading } from './odometer';
import { daysBetween } from './service';

export interface Ownership {
  purchasePrice: number | null;
  /** Everything spent since buying it, by category. */
  running: SpendSplit;
  /** Purchase price plus running costs. */
  totalCost: number;
  km: number;
  days: number;
  runningPerKm: number | null;
  totalPerKm: number | null;
  runningPerMonth: number | null;
}

/**
 * The whole-life picture: what the vehicle cost to buy and to run. Distance is measured from
 * the odometer at purchase, and time from the purchase date (or the first record if unset).
 */
export function ownership(
  vehicle: { purchasePrice?: number; purchaseDate?: string; purchaseOdometer: number },
  records: SpendRecords,
  readings: OdometerReading[],
  today: string,
): Ownership {
  const dates = [...records.fuel, ...records.services, ...records.accessories, ...records.expenses, ...(records.insurance ?? [])].map((r) => r.date).sort();
  const since = vehicle.purchaseDate ?? dates[0] ?? today;
  const running = spendBetween(records, '0000-01-01', '9999-12-31');
  const latest = readings.length ? Math.max(...readings.map((r) => r.odometer)) : vehicle.purchaseOdometer;
  const km = Math.max(0, latest - vehicle.purchaseOdometer);
  const days = Math.max(1, daysBetween(since, today) + 1);
  const purchasePrice = vehicle.purchasePrice ?? null;
  const totalCost = (purchasePrice ?? 0) + running.total;
  return {
    purchasePrice,
    running,
    totalCost,
    km,
    days,
    runningPerKm: km > 0 ? running.total / km : null,
    totalPerKm: km > 0 && purchasePrice != null ? totalCost / km : null,
    runningPerMonth: running.total > 0 ? running.total / (days / 30.4375) : null,
  };
}
