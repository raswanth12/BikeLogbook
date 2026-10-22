export interface LastChanged {
  itemTypeId: number;
  serviceRecordId: number;
  date: string;
  odometer: number;
  kmSince: number | null;
  daysSince: number;
}

/** Whole days from `from` to `to` (both 'YYYY-MM-DD'). Uses UTC so daylight saving can't shift it. */
export function daysBetween(from: string, to: string): number {
  const ms = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(to) - ms(from)) / 86_400_000);
}

/**
 * For each item type, the latest service that ticked it. "Latest" means highest odometer,
 * then latest date, matching how every other record is ordered.
 */
export function lastChanged(
  records: { id: number; date: string; odometer: number }[],
  items: { serviceRecordId: number; itemTypeId: number }[],
  currentOdometer: number | null,
  today: string,
): Map<number, LastChanged> {
  const byId = new Map(records.map((r) => [r.id, r]));
  const result = new Map<number, LastChanged>();

  for (const item of items) {
    const record = byId.get(item.serviceRecordId);
    if (!record) continue;
    const prev = result.get(item.itemTypeId);
    const newer = !prev || record.odometer > prev.odometer || (record.odometer === prev.odometer && record.date > prev.date);
    if (!newer) continue;
    result.set(item.itemTypeId, {
      itemTypeId: item.itemTypeId,
      serviceRecordId: record.id,
      date: record.date,
      odometer: record.odometer,
      kmSince: currentOdometer != null ? Math.max(0, currentOdometer - record.odometer) : null,
      daysSince: Math.max(0, daysBetween(record.date, today)),
    });
  }
  return result;
}

/** Default total for a service: item costs plus labour. */
export function serviceTotal(itemCosts: (number | null | undefined)[], labour: number | null | undefined): number {
  const sum = itemCosts.reduce<number>((s, c) => s + (c ?? 0), 0) + (labour ?? 0);
  return Math.round(sum * 100) / 100;
}
