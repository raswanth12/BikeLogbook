import { describe, expect, it } from 'vitest';
import { daysBetween, lastChanged, serviceTotal } from '../src/lib/calc/service';

describe('daysBetween', () => {
  it('counts whole days, across months and leap days', () => {
    expect(daysBetween('2026-10-01', '2026-10-22')).toBe(21);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
    expect(daysBetween('2026-10-22', '2026-10-22')).toBe(0);
  });
});

describe('lastChanged', () => {
  const records = [
    { id: 1, date: '2026-01-10', odometer: 10000 },
    { id: 2, date: '2026-05-10', odometer: 13000 },
    { id: 3, date: '2026-09-10', odometer: 16000 },
  ];
  const OIL = 1;
  const CHAIN = 2;
  const TYRE = 3;

  it('returns nothing with no services', () => {
    expect(lastChanged([], [], 20000, '2026-10-22').size).toBe(0);
  });

  it('picks the most recent service per item, with km and days since', () => {
    const items = [
      { serviceRecordId: 1, itemTypeId: OIL },
      { serviceRecordId: 3, itemTypeId: OIL },
      { serviceRecordId: 2, itemTypeId: OIL },
      { serviceRecordId: 1, itemTypeId: CHAIN },
    ];
    const map = lastChanged(records, items, 16800, '2026-10-22');
    expect(map.get(OIL)).toMatchObject({ serviceRecordId: 3, odometer: 16000, kmSince: 800, daysSince: 42 });
    expect(map.get(CHAIN)).toMatchObject({ serviceRecordId: 1, kmSince: 6800 });
    expect(map.has(TYRE)).toBe(false);
  });

  it('breaks an odometer tie by date', () => {
    const tied = [
      { id: 1, date: '2026-03-01', odometer: 12000 },
      { id: 2, date: '2026-03-02', odometer: 12000 },
    ];
    const items = [
      { serviceRecordId: 2, itemTypeId: OIL },
      { serviceRecordId: 1, itemTypeId: OIL },
    ];
    expect(lastChanged(tied, items, 12000, '2026-03-05').get(OIL)!.serviceRecordId).toBe(2);
  });

  it('ignores items whose service was deleted, and handles an unknown odometer', () => {
    const items = [
      { serviceRecordId: 99, itemTypeId: OIL },
      { serviceRecordId: 2, itemTypeId: CHAIN },
    ];
    const map = lastChanged(records, items, null, '2026-10-22');
    expect(map.has(OIL)).toBe(false);
    expect(map.get(CHAIN)!.kmSince).toBeNull();
  });
});

describe('serviceTotal', () => {
  it('adds item costs and labour, treating blanks as zero', () => {
    expect(serviceTotal([450.5, null, 120], 300)).toBe(870.5);
    expect(serviceTotal([], null)).toBe(0);
  });
});
