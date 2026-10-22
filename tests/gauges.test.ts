import { describe, expect, it } from 'vitest';
import { mileageGauge, serviceGauge, spendGauge } from '../src/lib/calc/gauges';
import { evaluateRule } from '../src/lib/reminders/evaluate';

const TODAY = '2026-10-22';

describe('serviceGauge', () => {
  it('uses the tighter of km and date left, for service items only', () => {
    const insurance = evaluateRule({ id: 1, title: 'Insurance', active: true, type: 'insurance', dueDate: '2026-10-25' }, 20000, TODAY);
    const oil = evaluateRule({ id: 2, title: 'Engine oil', active: true, type: 'serviceItem', dueOdometer: 22500, repeatKm: 10000, dueDate: '2027-10-22', repeatMonths: 12 }, 20000, TODAY);
    const g = serviceGauge([insurance, oil])!;
    expect(g.status.rule.id).toBe(2);
    expect(g.fill).toBeCloseTo(0.25);
    expect(g.tone).toBe('good');
  });

  it('is critical and empty when overdue, and null without service reminders', () => {
    const late = evaluateRule({ id: 3, title: 'Chain', active: true, type: 'serviceItem', dueOdometer: 19800, repeatKm: 500 }, 20000, TODAY);
    expect(serviceGauge([late])).toMatchObject({ fill: 0, tone: 'critical' });
    expect(serviceGauge([])).toBeNull();
  });
});

describe('mileageGauge', () => {
  it('rates recent mileage against the average', () => {
    expect(mileageGauge(30, 30)).toEqual({ fill: 0.8, tone: 'good' });
    expect(mileageGauge(28.5, 30).tone).toBe('warning');
    expect(mileageGauge(25, 30).tone).toBe('critical');
    expect(mileageGauge(null, 30)).toEqual({ fill: 0, tone: 'empty' });
  });
});

describe('spendGauge', () => {
  it('fills up as the month approaches a usual month', () => {
    expect(spendGauge(2000, [4000, 0, 4000])).toEqual({ fill: 0.5, tone: 'good', usual: 4000 });
    expect(spendGauge(4600, [4000]).tone).toBe('warning');
    expect(spendGauge(6000, [4000])).toMatchObject({ fill: 1, tone: 'critical' });
    expect(spendGauge(0, [])).toMatchObject({ tone: 'empty', usual: null });
  });
});
