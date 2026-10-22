export interface OdometerReading {
  source: 'purchase' | 'fuel' | 'trip' | 'service' | 'accessory' | 'expense';
  id: number;
  date: string;
  odometer: number;
}

export function latestOdometer(readings: OdometerReading[]): number | null {
  return readings.length ? Math.max(...readings.map((r) => r.odometer)) : null;
}

/**
 * The highest reading on or before `date`, ignoring the record being edited.
 * A new reading lower than this is probably a typo.
 */
export function previousReading(
  readings: OdometerReading[],
  date: string,
  exclude?: { source: OdometerReading['source']; id: number },
): OdometerReading | null {
  let best: OdometerReading | null = null;
  for (const r of readings) {
    if (exclude && r.source === exclude.source && r.id === exclude.id) continue;
    if (r.date > date) continue;
    if (!best || r.odometer > best.odometer) best = r;
  }
  return best;
}

export function checkOdometer(
  readings: OdometerReading[],
  date: string,
  odometer: number,
  exclude?: { source: OdometerReading['source']; id: number },
): { ok: boolean; previous: OdometerReading | null } {
  const previous = previousReading(readings, date, exclude);
  return { ok: !previous || odometer >= previous.odometer, previous };
}
