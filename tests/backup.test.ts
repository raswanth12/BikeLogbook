import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { createDatabase, type AppDB } from '../src/db';
import { backupFileName, createBackup, parseBackup, restoreMerge, restoreReplace, summarizeBackup } from '../src/lib/export/backup';

const open: AppDB[] = [];
let n = 0;
async function freshDb(): Promise<AppDB> {
  const d = createDatabase(`test-${Date.now()}-${n++}`);
  await d.open(); // runs the first-launch seed
  open.push(d);
  return d;
}

afterEach(async () => {
  for (const d of open.splice(0)) await d.delete();
});

/** A bike with one of everything, including a photo on a service. */
async function fill(d: AppDB) {
  const bikeId = (await d.settings.get(1))!.activeBikeId;
  const stationId = await d.stations.add({ name: 'HP, Ring Road' });
  await d.fuelEntries.bulkAdd([
    { bikeId, date: '2026-10-01', odometer: 1000, litres: 10, pricePerLitre: 104, totalCost: 1040, isFullTank: true, stationId, notes: '' },
    { bikeId, date: '2026-10-08', odometer: 1300, litres: 10, pricePerLitre: 104, totalCost: 1040, isFullTank: true, stationId, notes: '' },
  ]);
  await d.trips.add({ bikeId, date: '2026-10-05', startOdometer: 1100, endOdometer: 1250, purpose: 'Ride', tags: ['Ride'], notes: '' });
  const photoId = await d.photos.add({ blob: new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/jpeg' }), createdAt: 1 });
  const oil = (await d.serviceItemTypes.where('category').equals('engine').first())!;
  const custom = await d.serviceItemTypes.add({ name: 'Valve check', category: 'general', isCustom: true, hidden: false, sortOrder: 99 });
  const recordId = await d.serviceRecords.add({ bikeId, date: '2026-10-06', odometer: 1200, serviceCenter: 'RE', laborCost: 600, totalCost: 2450, notes: '', billPhotoIds: [photoId] });
  await d.serviceItems.bulkAdd([
    { serviceRecordId: recordId, itemTypeId: oil.id, cost: 1850 },
    { serviceRecordId: recordId, itemTypeId: custom },
  ]);
  await d.accessories.add({ bikeId, date: '2026-09-01', name: 'Crash guard', category: 'protection', price: 4500, shop: '', notes: '' });
  await d.expenses.add({ bikeId, date: '2026-10-07', category: 'toll', amount: 150, notes: '' });
  await d.reminderRules.add({ bikeId, title: 'Valve check', type: 'serviceItem', linkedItemTypeId: custom, dueOdometer: 11200, active: true });
  const policyId = await d.insurancePolicies.add({ bikeId, insurer: 'ICICI Lombard', policyNumber: 'P1', cover: 'comprehensive', startDate: '2026-03-15', endDate: '2027-03-14', premium: 9200, frequency: 'once', addOns: [], contact: '', notes: '' });
  await d.reminderRules.add({ bikeId, title: 'Insurance renewal', type: 'insurance', linkedPolicyId: policyId, policyEvent: 'renewal', active: true });
  await d.settings.update(1, { currencySymbol: 'Rs ', installGuideDismissed: true });
}

describe('parseBackup', () => {
  it('rejects files that are not backups', () => {
    expect(() => parseBackup('not json')).toThrow(/isn't valid JSON/);
    expect(() => parseBackup('{"app":"other","version":1,"tables":{}}')).toThrow(/isn't a Bike Logbook backup/);
    expect(() => parseBackup('{"app":"bike-logbook","version":99,"tables":{}}')).toThrow(/newer version/);
    expect(() => parseBackup('{"app":"bike-logbook","version":1,"tables":{"trips":5}}')).toThrow(/damaged/);
  });

  it('fills in missing tables as empty', () => {
    const b = parseBackup('{"app":"bike-logbook","version":1,"exportedAt":"x","tables":{}}');
    expect(b.tables.fuelEntries).toEqual([]);
  });

  it('names files by date', () => {
    expect(backupFileName('2026-10-22')).toBe('BikeLogbook_Backup_2026-10-22.json');
  });
});

describe('backup and restore', () => {
  it('replace restores everything exactly, photos included', async () => {
    const a = await freshDb();
    await fill(a);
    const backup = parseBackup(JSON.stringify(await createBackup(a)));
    expect(summarizeBackup(backup)).toMatchObject({ fuel: 2, trips: 1, services: 1, accessories: 1, expenses: 1, reminders: 2, policies: 1, photos: 1 });

    const b = await freshDb();
    await b.settings.update(1, { installGuideDismissed: false });
    await restoreReplace(b, backup);

    for (const name of ['bikes', 'fuelEntries', 'stations', 'trips', 'serviceItemTypes', 'serviceRecords', 'serviceItems', 'reminderRules', 'accessories', 'expenses', 'insurancePolicies']) {
      expect(await b.table(name).toArray()).toEqual(await a.table(name).toArray());
    }
    const photo = (await b.photos.toArray())[0];
    expect([...new Uint8Array(await photo.blob.arrayBuffer())]).toEqual([1, 2, 3, 250]);
    const settings = (await b.settings.get(1))!;
    expect(settings.currencySymbol).toBe('Rs ');
    expect(settings.installGuideDismissed).toBe(false); // this phone's own choice is kept
  });

  it('merge renumbers records and keeps links between them', async () => {
    const a = await freshDb();
    await fill(a);
    const backup = parseBackup(JSON.stringify(await createBackup(a)));

    const c = await freshDb();
    const bikeId = (await c.settings.get(1))!.activeBikeId;
    await c.expenses.add({ bikeId, date: '2026-01-01', category: 'parking', amount: 20, notes: 'already here' });
    await c.photos.add({ blob: new Blob(['x']), createdAt: 0 }); // takes photo id 1, so ids must shift

    const result = await restoreMerge(c, backup);
    expect(result.added).toBe(9); // 2 fuel, 1 trip, 1 expense, 1 accessory, 1 service, 1 policy, 2 reminders
    expect(await c.expenses.count()).toBe(2);

    const record = (await c.serviceRecords.toArray())[0];
    const photo = await c.photos.get(record.billPhotoIds[0]);
    expect([...new Uint8Array(await photo!.blob.arrayBuffer())]).toEqual([1, 2, 3, 250]);

    const items = await c.serviceItems.where('serviceRecordId').equals(record.id).toArray();
    const names = await Promise.all(items.map(async (i) => (await c.serviceItemTypes.get(i.itemTypeId))!.name));
    expect(names.sort()).toEqual(['Engine oil', 'Valve check']);
    // The seeded catalog matched by name; only the custom item was new.
    expect((await c.serviceItemTypes.toArray()).filter((t) => t.name === 'Engine oil')).toHaveLength(1);

    const rules = await c.reminderRules.toArray();
    const rule = rules.find((r) => r.linkedItemTypeId != null)!;
    expect((await c.serviceItemTypes.get(rule.linkedItemTypeId!))!.name).toBe('Valve check');
    const renewal = rules.find((r) => r.policyEvent === 'renewal')!;
    expect((await c.insurancePolicies.get(renewal.linkedPolicyId!))!.insurer).toBe('ICICI Lombard');
    const fuel = await c.fuelEntries.toArray();
    expect((await c.stations.get(fuel[0].stationId!))!.name).toBe('HP, Ring Road');
  });

  it('merging the same backup twice adds nothing the second time', async () => {
    const a = await freshDb();
    await fill(a);
    const backup = parseBackup(JSON.stringify(await createBackup(a)));
    const c = await freshDb();
    await restoreMerge(c, backup);
    const photos = await c.photos.count();
    const second = await restoreMerge(c, backup);
    expect(second).toEqual({ added: 0, skipped: 9 });
    expect(await c.photos.count()).toBe(photos);
    expect(await c.fuelEntries.count()).toBe(2);
  });
});
