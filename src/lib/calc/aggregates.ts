export interface SpendRecords {
  fuel: { date: string; totalCost: number }[];
  services: { date: string; totalCost: number }[];
  accessories: { date: string; price: number }[];
  expenses: { date: string; amount: number; category?: string }[];
  /** Insurance premiums paid (see insurancePayments). */
  insurance?: { date: string; amount: number }[];
}

export interface SpendSplit {
  fuel: number;
  service: number;
  accessories: number;
  other: number;
  insurance: number;
  total: number;
}

/** First and last day of the month containing `iso` ('YYYY-MM-DD'). */
export function monthBounds(iso: string): { start: string; end: string } {
  const [y, m] = iso.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, '0');
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(lastDay).padStart(2, '0')}` };
}

/** Spend per category between two dates, both inclusive. */
export function spendBetween(records: SpendRecords, start: string, end: string): SpendSplit {
  const inRange = (d: string) => d >= start && d <= end;
  const sum = <T extends { date: string }>(list: T[], value: (r: T) => number) =>
    list.filter((r) => inRange(r.date)).reduce((s, r) => s + value(r), 0);

  const fuel = sum(records.fuel, (r) => r.totalCost);
  const service = sum(records.services, (r) => r.totalCost);
  const accessories = sum(records.accessories, (r) => r.price);
  // Insurance logged as a plain expense counts as insurance too, not "other".
  const isInsurance = (e: { category?: string }) => e.category === 'insurance';
  const other = sum(records.expenses.filter((e) => !isInsurance(e)), (r) => r.amount);
  const insurance = sum(records.expenses.filter(isInsurance), (r) => r.amount) + sum(records.insurance ?? [], (r) => r.amount);
  return { fuel, service, accessories, other, insurance, total: fuel + service + accessories + other + insurance };
}
