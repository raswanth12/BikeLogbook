import type { ReminderStatus } from '../reminders/evaluate';

export type GaugeTone = 'good' | 'warning' | 'critical' | 'empty';

export interface Gauge {
  /** How full the ring is, 0 to 1. */
  fill: number;
  tone: GaugeTone;
}

const clamp = (n: number) => Math.min(1, Math.max(0, n));

/**
 * The next service ring: how much of the interval is left before the most urgent service
 * item with an interval, by km or by date, whichever is tighter. Full means just serviced.
 */
export function serviceGauge(statuses: ReminderStatus<{ id: number; title: string; active: boolean; type?: string; repeatKm?: number; repeatMonths?: number }>[]): (Gauge & { status: (typeof statuses)[number] }) | null {
  for (const s of statuses) {
    if (s.rule.type !== 'serviceItem') continue;
    const parts: number[] = [];
    if (s.kmLeft != null && s.rule.repeatKm) parts.push(s.kmLeft / s.rule.repeatKm);
    if (s.daysLeft != null && s.rule.repeatMonths) parts.push(s.daysLeft / (s.rule.repeatMonths * 30.4375));
    if (!parts.length) continue;
    const fill = clamp(Math.min(...parts));
    const tone: GaugeTone = s.state === 'overdue' ? 'critical' : s.state === 'soon' || fill < 0.2 ? 'warning' : 'good';
    return { fill, tone, status: s };
  }
  return null;
}

/** Recent mileage against your average. The average sits at 80% of the ring. */
export function mileageGauge(last5: number | null, overall: number | null): Gauge {
  if (!last5 || !overall) return { fill: 0, tone: 'empty' };
  const ratio = last5 / overall;
  return { fill: clamp(ratio / 1.25), tone: ratio >= 0.99 ? 'good' : ratio >= 0.93 ? 'warning' : 'critical' };
}

/**
 * This month's spend against your usual month (the average of the months before it that
 * had any spending). A full ring means you've spent a usual month's worth.
 */
export function spendGauge(thisMonth: number, previousMonths: number[]): Gauge & { usual: number | null } {
  const past = previousMonths.filter((m) => m > 0);
  if (!past.length) return { fill: thisMonth > 0 ? 1 : 0, tone: thisMonth > 0 ? 'good' : 'empty', usual: null };
  const usual = past.reduce((s, m) => s + m, 0) / past.length;
  const ratio = thisMonth / usual;
  return { fill: clamp(ratio), tone: ratio <= 1 ? 'good' : ratio <= 1.25 ? 'warning' : 'critical', usual };
}
