import { addMonths } from '../reminders/evaluate';
import { daysBetween } from './service';

export interface PolicyLike {
  startDate: string;
  endDate: string;
  premium: number;
  frequency: 'once' | 'yearly' | 'monthly';
}

export interface Payment {
  date: string;
  amount: number;
}

/**
 * Every premium payment a policy involves: one at the start if paid once, then every year
 * or every month from the start date until the policy ends.
 */
export function policyPayments(p: PolicyLike): Payment[] {
  if (p.frequency === 'once') return [{ date: p.startDate, amount: p.premium }];
  const step = p.frequency === 'yearly' ? 12 : 1;
  const out: Payment[] = [];
  // Guard against a mistyped end date producing thousands of payments.
  for (let i = 0; i < 600; i++) {
    const date = addMonths(p.startDate, i * step);
    if (date > p.endDate) break;
    out.push({ date, amount: p.premium });
  }
  return out;
}

/** Payments made on or before `upTo`, for all policies: these count as money spent. */
export function insurancePayments(policies: PolicyLike[], upTo: string): Payment[] {
  return policies.flatMap(policyPayments).filter((x) => x.date <= upTo);
}

/** Policy length in whole months, at least one. */
export function termMonths(p: Pick<PolicyLike, 'startDate' | 'endDate'>): number {
  return Math.max(1, Math.round((daysBetween(p.startDate, p.endDate) + 1) / 30.4375));
}

/** What the policy costs in total, and what that works out to per year and per month. */
export function policyCost(p: PolicyLike): { total: number; perYear: number; perMonth: number; months: number } {
  const total = policyPayments(p).reduce((s, x) => s + x.amount, 0);
  const months = termMonths(p);
  return { total, perYear: (total / months) * 12, perMonth: total / months, months };
}

export type PolicyState = 'active' | 'upcoming' | 'expired';

export function policyState(p: Pick<PolicyLike, 'startDate' | 'endDate'>, today: string): { state: PolicyState; daysLeft: number } {
  const state: PolicyState = today < p.startDate ? 'upcoming' : today > p.endDate ? 'expired' : 'active';
  return { state, daysLeft: daysBetween(today, p.endDate) };
}

/** The policy covering today, or else the one that ended most recently or starts soonest. */
export function currentPolicy<P extends PolicyLike>(policies: P[], today: string): P | null {
  const active = policies.filter((p) => p.startDate <= today && p.endDate >= today).sort((a, b) => b.startDate.localeCompare(a.startDate));
  if (active.length) return active[0];
  const byEnd = [...policies].sort((a, b) => b.endDate.localeCompare(a.endDate));
  return byEnd[0] ?? null;
}

/** A year of cover starting the day after `endDate` ends: the usual renewal. */
export function renewalDates(endDate: string): { startDate: string; endDate: string } {
  const [y, m, d] = endDate.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  const [sy, sm, sd] = addMonths(start, 12).split('-').map(Number);
  const end = new Date(Date.UTC(sy, sm - 1, sd - 1)).toISOString().slice(0, 10);
  return { startDate: start, endDate: end };
}
