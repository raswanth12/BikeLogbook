import { daysBetween } from '../calc/service';

export const SOON_KM = 200;
export const SOON_DAYS = 15;

export interface RuleLike {
  id: number;
  title: string;
  active: boolean;
  dueOdometer?: number;
  dueDate?: string;
  repeatKm?: number;
  repeatMonths?: number;
  linkedItemTypeId?: number;
  alertDays?: number;
}

export type ReminderState = 'overdue' | 'soon' | 'ok' | 'unscheduled';

export interface ReminderStatus<R extends RuleLike = RuleLike> {
  rule: R;
  state: ReminderState;
  /** Km until due; negative when overdue. Null when there's no km target or no reading. */
  kmLeft: number | null;
  /** Days until due; negative when overdue. Null when there's no date target. */
  daysLeft: number | null;
  /** When the km target will likely be reached, at your recent pace. */
  projectedDate: string | null;
  /** The service window: from 10% of the interval before the due point, up to it. */
  window: { fromKm?: number; toKm?: number; fromDate?: string; toDate?: string } | null;
}

/**
 * Average km a day over the last `days` days of readings, or null with too little data.
 * Used to guess when a km-based reminder will come due.
 */
export function kmPerDay(readings: { date: string; odometer: number }[], today: string, days = 90): number | null {
  const from = addDays(today, -days);
  const recent = readings.filter((r) => r.date >= from && r.date <= today);
  if (recent.length < 2) return null;
  const sorted = [...recent].sort((a, b) => a.date.localeCompare(b.date) || a.odometer - b.odometer);
  const span = daysBetween(sorted[0].date, sorted[sorted.length - 1].date);
  const km = sorted[sorted.length - 1].odometer - sorted[0].odometer;
  return span >= 7 && km > 0 ? km / span : null;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Adds whole months, clamping to the month's last day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Due when either the km or the date target is reached, whichever comes first. */
export function evaluateRule<R extends RuleLike>(rule: R, currentOdometer: number | null, today: string, pace: number | null = null): ReminderStatus<R> {
  const kmLeft = rule.dueOdometer != null && currentOdometer != null ? rule.dueOdometer - currentOdometer : null;
  const daysLeft = rule.dueDate ? daysBetween(today, rule.dueDate) : null;
  const soonDays = rule.alertDays ?? SOON_DAYS;

  let state: ReminderState;
  if (kmLeft == null && daysLeft == null) state = 'unscheduled';
  else if ((kmLeft != null && kmLeft < 0) || (daysLeft != null && daysLeft < 0)) state = 'overdue';
  else if ((kmLeft != null && kmLeft <= SOON_KM) || (daysLeft != null && daysLeft <= soonDays)) state = 'soon';
  else state = 'ok';

  const projectedDate = kmLeft != null && kmLeft > 0 && pace ? addDays(today, Math.ceil(kmLeft / pace)) : null;

  let window: ReminderStatus['window'] = null;
  if (rule.repeatKm && rule.dueOdometer != null) window = { fromKm: rule.dueOdometer - Math.round(rule.repeatKm * 0.1), toKm: rule.dueOdometer };
  if (rule.repeatMonths && rule.dueDate) {
    // A tenth of the interval, in whole months: a 12-month service opens a month early.
    const lead = Math.max(1, Math.round(rule.repeatMonths * 0.1));
    window = { ...window, fromDate: addMonths(rule.dueDate, -lead), toDate: rule.dueDate };
  }
  return { rule, state, kmLeft, daysLeft, projectedDate, window };
}

const RANK: Record<ReminderState, number> = { overdue: 0, soon: 1, ok: 2, unscheduled: 3 };

/** Active reminders, most urgent first. */
export function evaluateRules<R extends RuleLike>(rules: R[], currentOdometer: number | null, today: string, pace: number | null = null): ReminderStatus<R>[] {
  // Rough common scale for sorting: a day is treated like 30 km.
  const urgency = (s: ReminderStatus) => Math.min(s.daysLeft != null ? s.daysLeft * 30 : Infinity, s.kmLeft ?? Infinity);
  return rules
    .filter((r) => r.active)
    .map((r) => evaluateRule(r, currentOdometer, today, pace))
    .sort((a, b) => RANK[a.state] - RANK[b.state] || urgency(a) - urgency(b));
}

/**
 * The next due point after the item is serviced at `odometer` on `date`. Uses the reminder's
 * own repeat interval, falling back to the checklist item's default. Null if neither has one.
 */
export function nextDueAfterService(
  rule: Pick<RuleLike, 'repeatKm' | 'repeatMonths'>,
  item: { defaultIntervalKm?: number; defaultIntervalMonths?: number } | undefined,
  odometer: number,
  date: string,
): { dueOdometer?: number; dueDate?: string } | null {
  const km = rule.repeatKm ?? item?.defaultIntervalKm;
  const months = rule.repeatMonths ?? item?.defaultIntervalMonths;
  if (!km && !months) return null;
  return { dueOdometer: km ? odometer + km : undefined, dueDate: months ? addMonths(date, months) : undefined };
}

/** Plain-language status, e.g. "Due in 180 km", "Overdue by 3 days", "Due in 1,200 km or 40 days". */
export function describeStatus(s: ReminderStatus, distanceUnit: string): string {
  const fmt = (n: number) => Math.abs(n).toLocaleString();
  const km = s.kmLeft != null ? `${fmt(s.kmLeft)} ${distanceUnit}` : null;
  const days = s.daysLeft != null ? `${fmt(s.daysLeft)} ${Math.abs(s.daysLeft) === 1 ? 'day' : 'days'}` : null;

  if (s.state === 'unscheduled') return 'No due point set';
  if (s.state === 'overdue') {
    const parts = [s.kmLeft != null && s.kmLeft < 0 ? km : null, s.daysLeft != null && s.daysLeft < 0 ? days : null].filter(Boolean);
    return `Overdue by ${parts.join(' and ')}`;
  }
  if (s.daysLeft === 0) return 'Due today';
  if (s.kmLeft === 0) return 'Due now';
  return `Due in ${[km, days].filter(Boolean).join(' or ')}`;
}
