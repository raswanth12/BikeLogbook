import { describe, expect, it } from 'vitest';
import { buildIcs } from '../src/lib/export/ics';
import { addMonths, describeStatus, evaluateRule, evaluateRules, nextDueAfterService, type RuleLike } from '../src/lib/reminders/evaluate';

const rule = (over: Partial<RuleLike>): RuleLike => ({ id: 1, title: 'Engine oil', active: true, ...over });
const TODAY = '2026-10-22';

describe('addMonths', () => {
  it('adds months and clamps to the end of shorter months', () => {
    expect(addMonths('2026-10-22', 12)).toBe('2027-10-22');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
  });
});

describe('evaluateRule', () => {
  it('is unscheduled with no targets', () => {
    expect(evaluateRule(rule({}), 10000, TODAY).state).toBe('unscheduled');
  });

  it('uses km left against the current odometer', () => {
    expect(evaluateRule(rule({ dueOdometer: 10500 }), 10000, TODAY)).toMatchObject({ state: 'ok', kmLeft: 500 });
    expect(evaluateRule(rule({ dueOdometer: 10150 }), 10000, TODAY)).toMatchObject({ state: 'soon', kmLeft: 150 });
    expect(evaluateRule(rule({ dueOdometer: 9900 }), 10000, TODAY)).toMatchObject({ state: 'overdue', kmLeft: -100 });
  });

  it('ignores the km target when there is no reading yet', () => {
    expect(evaluateRule(rule({ dueOdometer: 9900 }), null, TODAY)).toMatchObject({ state: 'unscheduled', kmLeft: null });
  });

  it('uses days left against today', () => {
    expect(evaluateRule(rule({ dueDate: '2026-12-01' }), null, TODAY)).toMatchObject({ state: 'ok', daysLeft: 40 });
    expect(evaluateRule(rule({ dueDate: '2026-11-01' }), null, TODAY)).toMatchObject({ state: 'soon', daysLeft: 10 });
    expect(evaluateRule(rule({ dueDate: TODAY }), null, TODAY)).toMatchObject({ state: 'soon', daysLeft: 0 });
    expect(evaluateRule(rule({ dueDate: '2026-10-20' }), null, TODAY)).toMatchObject({ state: 'overdue', daysLeft: -2 });
  });

  it('is due when either target is reached', () => {
    expect(evaluateRule(rule({ dueOdometer: 20000, dueDate: '2026-10-01' }), 10000, TODAY).state).toBe('overdue');
    expect(evaluateRule(rule({ dueOdometer: 10100, dueDate: '2027-10-01' }), 10000, TODAY).state).toBe('soon');
  });
});

describe('evaluateRules', () => {
  it('drops paused reminders and sorts the most urgent first', () => {
    const out = evaluateRules(
      [
        rule({ id: 1, dueOdometer: 15000 }),
        rule({ id: 2, dueDate: '2026-10-25' }),
        rule({ id: 3, dueOdometer: 9000 }),
        rule({ id: 4, dueOdometer: 9000, active: false }),
        rule({ id: 5 }),
      ],
      10000,
      TODAY,
    );
    expect(out.map((s) => s.rule.id)).toEqual([3, 2, 1, 5]);
  });
});

describe('nextDueAfterService', () => {
  it('prefers the reminder interval, then the checklist default', () => {
    expect(nextDueAfterService({ repeatKm: 5000 }, { defaultIntervalKm: 10000, defaultIntervalMonths: 12 }, 20000, '2026-10-22')).toEqual({
      dueOdometer: 25000,
      dueDate: '2027-10-22',
    });
    expect(nextDueAfterService({}, { defaultIntervalKm: 10000 }, 20000, '2026-10-22')).toEqual({ dueOdometer: 30000, dueDate: undefined });
  });

  it('returns null when nothing says how often', () => {
    expect(nextDueAfterService({}, undefined, 20000, '2026-10-22')).toBeNull();
  });
});

describe('describeStatus', () => {
  it('reads naturally', () => {
    expect(describeStatus(evaluateRule(rule({ dueOdometer: 10180 }), 10000, TODAY), 'km')).toBe('Due in 180 km');
    expect(describeStatus(evaluateRule(rule({ dueOdometer: 11200, dueDate: '2026-12-01' }), 10000, TODAY), 'km')).toBe('Due in 1,200 km or 40 days');
    expect(describeStatus(evaluateRule(rule({ dueDate: '2026-10-21' }), null, TODAY), 'km')).toBe('Overdue by 1 day');
    expect(describeStatus(evaluateRule(rule({ dueDate: TODAY }), null, TODAY), 'km')).toBe('Due today');
  });
});

describe('buildIcs', () => {
  const ics = buildIcs(
    [
      { id: 7, title: 'Insurance, renew', dueDate: '2027-03-15', repeatMonths: 12, description: 'Policy; comprehensive' },
      { id: 8, title: 'PUC', dueDate: '2027-01-31' },
    ],
    new Date(Date.UTC(2026, 9, 22, 10, 30, 0)),
  );

  it('writes a calendar with one all-day event per reminder', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('DTSTART;VALUE=DATE:20270315');
    expect(ics).toContain('DTEND;VALUE=DATE:20270316');
    expect(ics).toContain('DTEND;VALUE=DATE:20270201');
    expect(ics).toContain('DTSTAMP:20261022T103000Z');
  });

  it('escapes text and repeats where asked', () => {
    expect(ics).toContain('SUMMARY:Insurance\\, renew');
    expect(ics).toContain('DESCRIPTION:Policy\\; comprehensive');
    expect(ics).toContain('RRULE:FREQ=MONTHLY;INTERVAL=12');
    expect(ics.match(/RRULE/g)).toHaveLength(1);
    expect(ics).toContain('TRIGGER:-P7D');
  });

  it('folds long lines to 75 octets', () => {
    const long = buildIcs([{ id: 1, title: 'x'.repeat(200), dueDate: '2027-01-01' }]);
    for (const line of long.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});

import { kmPerDay } from '../src/lib/reminders/evaluate';
import { resolvePolicyRules } from '../src/lib/reminders/policies';

describe('service window and projected date', () => {
  it('estimates riding pace from recent readings', () => {
    const readings = [
      { date: '2026-08-01', odometer: 10000 },
      { date: '2026-09-01', odometer: 10930 },
      { date: '2026-10-21', odometer: 12400 },
    ];
    expect(kmPerDay(readings, '2026-10-22')).toBeCloseTo(2400 / 81, 6);
    expect(kmPerDay(readings.slice(0, 1), '2026-10-22')).toBeNull();
  });

  it('projects when a km target will be reached, and shows the window', () => {
    const s = evaluateRule(rule({ dueOdometer: 13000, repeatKm: 10000, dueDate: '2027-04-05', repeatMonths: 12 }), 12400, TODAY, 30);
    expect(s.projectedDate).toBe('2026-11-11'); // 600 km at 30 km a day = 20 days
    expect(s.window).toEqual({ fromKm: 12000, toKm: 13000, fromDate: '2027-03-05', toDate: '2027-04-05' });
  });

  it('uses the reminder lead time for "due soon"', () => {
    expect(evaluateRule(rule({ dueDate: '2026-10-25', alertDays: 2 }), null, TODAY).state).toBe('ok');
    expect(evaluateRule(rule({ dueDate: '2026-10-24', alertDays: 2 }), null, TODAY).state).toBe('soon');
  });
});

describe('resolvePolicyRules', () => {
  const policy = { id: 9, startDate: '2026-08-10', endDate: '2027-08-09', premium: 700, frequency: 'monthly' as const };

  it('moves a premium reminder to the next payment and a renewal to the end date', () => {
    const [premium, renewal] = resolvePolicyRules(
      [
        { linkedPolicyId: 9, policyEvent: 'premium', active: true },
        { linkedPolicyId: 9, policyEvent: 'renewal', active: true },
      ] as { linkedPolicyId: number; policyEvent: 'premium' | 'renewal'; active: boolean; dueDate?: string }[],
      [policy],
      '2026-10-22',
    );
    expect(premium.dueDate).toBe('2026-11-10');
    expect(renewal.dueDate).toBe('2027-08-09');
  });

  it('pauses a premium reminder once nothing is left to pay', () => {
    const [r] = resolvePolicyRules([{ linkedPolicyId: 9, policyEvent: 'premium' as const, active: true }], [policy], '2027-09-01');
    expect(r.active).toBe(false);
  });
});
