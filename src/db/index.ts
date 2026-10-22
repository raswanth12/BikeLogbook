import Dexie, { type EntityTable } from 'dexie';
import type {
  Accessory,
  Bike,
  Expense,
  FuelEntry,
  InsurancePolicy,
  Photo,
  ReminderRule,
  ServiceItem,
  ServiceItemType,
  ServiceRecord,
  Settings,
  Station,
  Trip,
} from './types';
import { defaultInterval, defaultKinds, seedServiceItemTypes } from './seed';

export type AppDB = Dexie & {
  bikes: EntityTable<Bike, 'id'>;
  fuelEntries: EntityTable<FuelEntry, 'id'>;
  stations: EntityTable<Station, 'id'>;
  trips: EntityTable<Trip, 'id'>;
  serviceItemTypes: EntityTable<ServiceItemType, 'id'>;
  serviceRecords: EntityTable<ServiceRecord, 'id'>;
  serviceItems: EntityTable<ServiceItem, 'id'>;
  reminderRules: EntityTable<ReminderRule, 'id'>;
  accessories: EntityTable<Accessory, 'id'>;
  expenses: EntityTable<Expense, 'id'>;
  photos: EntityTable<Photo, 'id'>;
  settings: EntityTable<Settings, 'id'>;
  insurancePolicies: EntityTable<InsurancePolicy, 'id'>;
};

/** Opens (or creates) the app's database. Tests pass their own name to get a fresh copy. */
export function createDatabase(name: string): AppDB {
  const db = new Dexie(name) as AppDB;

  db.version(1).stores({
    bikes: '++id',
    fuelEntries: '++id, bikeId, date, odometer',
    stations: '++id, name',
    trips: '++id, bikeId, date',
    serviceItemTypes: '++id, category, sortOrder',
    serviceRecords: '++id, bikeId, date, odometer',
    serviceItems: '++id, serviceRecordId, itemTypeId',
    reminderRules: '++id, bikeId',
    accessories: '++id, bikeId, date',
    expenses: '++id, bikeId, date',
    photos: '++id',
    settings: 'id',
  });

  // v2: fill in default service intervals on databases created before they existed.
  // Only touches built-in items that have no interval yet, so your own edits are kept.
  db.version(2).stores({}).upgrade(async (tx) => {
    await tx
      .table('serviceItemTypes')
      .toCollection()
      .modify((item: ServiceItemType) => {
        if (item.isCustom || item.defaultIntervalKm != null || item.defaultIntervalMonths != null) return;
        const { km, months } = defaultInterval(item.name);
        if (km != null) item.defaultIntervalKm = km;
        if (months != null) item.defaultIntervalMonths = months;
      });
  });

  // v3: index fuel by station, so deleting a station can find its fill-ups.
  db.version(3).stores({ fuelEntries: '++id, bikeId, date, odometer, stationId' });

  // v4: several vehicles of different kinds, insurance policies, and a checklist that knows
  // which items suit which vehicle. Existing data is kept; old vehicles become motorcycles.
  db.version(4)
    .stores({ insurancePolicies: '++id, bikeId, endDate' })
    .upgrade(async (tx) => {
      await tx
        .table('bikes')
        .toCollection()
        .modify((b: Bike) => {
          b.kind ??= 'motorcycle';
          b.fuelKind ??= 'petrol';
        });
      const types = tx.table('serviceItemTypes');
      const existing = (await types.toArray()) as ServiceItemType[];
      for (const t of existing) {
        const kinds = defaultKinds(t.name);
        if (!t.isCustom && kinds && !t.kinds) await types.update(t.id, { kinds });
      }
      // Add the new car and scooter items after what's there, keeping your order.
      let order = Math.max(0, ...existing.map((t) => t.sortOrder));
      const names = new Set(existing.map((t) => t.name.toLowerCase()));
      for (const seed of seedServiceItemTypes()) {
        if (!names.has(seed.name.toLowerCase())) await types.add({ ...seed, sortOrder: ++order });
      }
    });

  // Runs once, when the database is first created on this device.
  db.on('populate', async (tx) => {
    const bikeId = (await tx.table('bikes').add({
      name: 'Himalayan 450',
      kind: 'motorcycle',
      fuelKind: 'petrol',
      make: 'Royal Enfield',
      model: 'Himalayan 450',
      registration: '',
      purchaseOdometer: 0,
      tankCapacity: 17,
      notes: '',
    })) as number;

    await tx.table('serviceItemTypes').bulkAdd(seedServiceItemTypes());

    const settings: Settings = {
      id: 1,
      currencyCode: 'INR',
      currencySymbol: '₹',
      distanceUnit: 'km',
      fuelUnit: 'L',
      mileageUnit: 'km/l',
      activeBikeId: bikeId,
      installGuideDismissed: false,
    };
    await tx.table('settings').add(settings);
  });

  return db;
}

export const db = createDatabase('bike-logbook');
