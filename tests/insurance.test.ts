import { describe, expect, it } from 'vitest';
import { currentPolicy, insurancePayments, policyCost, policyPayments, policyState, renewalDates, termMonths } from '../src/lib/calc/insurance';

const yearPolicy = { startDate: '2026-03-15', endDate: '2027-03-14', premium: 9200, frequency: 'once' as const };

describe('policyPayments', () => {
  it('is a single payment when paid once', () => {
    expect(policyPayments(yearPolicy)).toEqual([{ date: '2026-03-15', amount: 9200 }]);
  });

  it('repeats every month until the policy ends', () => {
    // A year of cover from 31 Jan, paid monthly: twelve instalments, short months clamped.
    const monthly = policyPayments({ startDate: '2026-01-31', endDate: '2027-01-30', premium: 800, frequency: 'monthly' });
    expect(monthly).toHaveLength(12);
    expect(monthly[1].date).toBe('2026-02-28');
    expect(monthly[11].date).toBe('2026-12-31');
  });

  it('repeats every year on a multi-year policy', () => {
    const tp = policyPayments({ startDate: '2025-06-01', endDate: '2030-05-31', premium: 1500, frequency: 'yearly' });
    expect(tp.map((p) => p.date)).toEqual(['2025-06-01', '2026-06-01', '2027-06-01', '2028-06-01', '2029-06-01']);
  });
});

describe('insurancePayments', () => {
  it('only counts payments made so far', () => {
    const p = { startDate: '2026-08-10', endDate: '2027-08-09', premium: 700, frequency: 'monthly' as const };
    expect(insurancePayments([p, yearPolicy], '2026-10-22')).toHaveLength(1 + 3); // Aug, Sep, Oct + the one-off
  });
});

describe('policyCost', () => {
  it('works out per year and per month', () => {
    expect(termMonths(yearPolicy)).toBe(12);
    expect(policyCost(yearPolicy)).toMatchObject({ total: 9200, perYear: 9200, months: 12 });
    expect(policyCost(yearPolicy).perMonth).toBeCloseTo(766.67, 2);
  });

  it('spreads a five-year third-party premium paid once', () => {
    const c = policyCost({ startDate: '2026-01-01', endDate: '2030-12-31', premium: 6000, frequency: 'once' });
    expect(c.months).toBe(60);
    expect(c.perYear).toBe(1200);
  });
});

describe('policy dates', () => {
  it('knows whether a policy is active, upcoming or expired', () => {
    expect(policyState(yearPolicy, '2026-10-22')).toEqual({ state: 'active', daysLeft: 143 });
    expect(policyState(yearPolicy, '2027-04-01').state).toBe('expired');
    expect(policyState(yearPolicy, '2026-01-01').state).toBe('upcoming');
  });

  it('picks the policy covering today, else the latest', () => {
    const old = { ...yearPolicy, startDate: '2025-03-15', endDate: '2026-03-14' };
    expect(currentPolicy([old, yearPolicy], '2026-10-22')).toBe(yearPolicy);
    expect(currentPolicy([old], '2026-10-22')).toBe(old);
    expect(currentPolicy([], '2026-10-22')).toBeNull();
  });

  it('proposes a renewal starting the next day for a year', () => {
    expect(renewalDates('2027-03-14')).toEqual({ startDate: '2027-03-15', endDate: '2028-03-14' });
    expect(renewalDates('2028-02-28')).toEqual({ startDate: '2028-02-29', endDate: '2029-02-27' });
  });
});
