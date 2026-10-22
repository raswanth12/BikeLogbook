import type { AppDB } from '../../db';
import type {
  Accessory,
  Bike,
  Expense,
  FuelEntry,
  InsurancePolicy,
  ReminderRule,
  ServiceItem,
  ServiceItemType,
  ServiceRecord,
  Settings,
  Station,
  Trip,
} from '../../db/types';

export const BACKUP_VERSION = 1;

interface PhotoRecord {
  id: number;
  createdAt: number;
  type: string;
  data: string; // base64
}

export interface BackupFile {
  app: 'bike-logbook';
  version: number;
  exportedAt: string;
  tables: {
    bikes: Bike[];
    fuelEntries: FuelEntry[];
    stations: Station[];
    trips: Trip[];
    serviceItemTypes: ServiceItemType[];
    serviceRecords: ServiceRecord[];
    serviceItems: ServiceItem[];
    reminderRules: ReminderRule[];
    accessories: Accessory[];
    expenses: Expense[];
    photos: PhotoRecord[];
    settings: Settings[];
    insurancePolicies: InsurancePolicy[];
  };
}

type TableName = keyof BackupFile['tables'];
const TABLES: TableName[] = [
  'bikes',
  'fuelEntries',
  'stations',
  'trips',
  'serviceItemTypes',
  'serviceRecords',
  'serviceItems',
  'reminderRules',
  'accessories',
  'expenses',
  'photos',
  'settings',
  'insurancePolicies',
];

async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  // In chunks, so large photos don't overflow the argument list.
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function base64ToBlob(data: string, type: string): Blob {
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

export async function createBackup(database: AppDB, now = new Date()): Promise<BackupFile> {
  const read = <T>(name: TableName) => database.table(name).toArray() as Promise<T[]>;
  const photos = await database.photos.toArray();
  return {
    app: 'bike-logbook',
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    tables: {
      bikes: await read('bikes'),
      fuelEntries: await read('fuelEntries'),
      stations: await read('stations'),
      trips: await read('trips'),
      serviceItemTypes: await read('serviceItemTypes'),
      serviceRecords: await read('serviceRecords'),
      serviceItems: await read('serviceItems'),
      reminderRules: await read('reminderRules'),
      accessories: await read('accessories'),
      expenses: await read('expenses'),
      photos: await Promise.all(photos.map(async (p) => ({ id: p.id, createdAt: p.createdAt, type: p.blob.type || 'image/jpeg', data: await blobToBase64(p.blob) }))),
      settings: await read('settings'),
      insurancePolicies: await read('insurancePolicies'),
    },
  };
}

export function backupFileName(today: string): string {
  return `BikeLogbook_Backup_${today}.json`;
}

/** Reads a backup file's text. Throws an Error with a message fit to show the user. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("This file isn't a Bike Logbook backup (it isn't valid JSON).");
  }
  const obj = raw as Partial<BackupFile> | null;
  if (!obj || obj.app !== 'bike-logbook' || typeof obj.tables !== 'object' || obj.tables === null) {
    throw new Error("This file isn't a Bike Logbook backup.");
  }
  if (typeof obj.version !== 'number' || obj.version > BACKUP_VERSION) {
    throw new Error('This backup was made by a newer version of the app. Update the app, then try again.');
  }
  const tables = obj.tables as Record<string, unknown>;
  for (const name of TABLES) {
    if (tables[name] === undefined) tables[name] = [];
    if (!Array.isArray(tables[name])) throw new Error(`The backup is damaged: "${name}" isn't a list.`);
  }
  return obj as BackupFile;
}

export function summarizeBackup(b: BackupFile) {
  const t = b.tables;
  return {
    exportedAt: b.exportedAt,
    fuel: t.fuelEntries.length,
    trips: t.trips.length,
    services: t.serviceRecords.length,
    accessories: t.accessories.length,
    expenses: t.expenses.length,
    reminders: t.reminderRules.length,
    policies: t.insurancePolicies.length,
    photos: t.photos.length,
  };
}

/** These stay as they are on this phone, whatever the backup says. */
function keepLocal(current: Settings | undefined, incoming: Settings): Settings {
  return {
    ...incoming,
    id: 1,
    installGuideDismissed: current?.installGuideDismissed ?? incoming.installGuideDismissed,
    persistentStorage: current?.persistentStorage,
    lastBackupDate: current?.lastBackupDate ?? incoming.lastBackupDate,
    // Google sign-in details belong to this phone's setup, not the data.
    googleClientId: current?.googleClientId ?? incoming.googleClientId,
    driveFolderId: current?.driveFolderId ?? incoming.driveFolderId,
    lastDriveBackup: current?.lastDriveBackup,
  };
}

/** Wipes this phone's data and loads the backup exactly, ids included. */
export async function restoreReplace(database: AppDB, backup: BackupFile): Promise<void> {
  await database.transaction('rw', database.tables, async () => {
    const current = await database.settings.get(1);
    for (const table of database.tables) await table.clear();
    for (const name of TABLES) {
      if (name === 'photos' || name === 'settings') continue;
      await database.table(name).bulkAdd(backup.tables[name]);
    }
    await database.photos.bulkAdd(backup.tables.photos.map((p) => ({ id: p.id, createdAt: p.createdAt, blob: base64ToBlob(p.data, p.type) })));
    const incoming = backup.tables.settings[0];
    if (incoming) await database.settings.put(keepLocal(current, incoming));
    else if (current) await database.settings.put(current);
    // Make sure the active bike still exists.
    const settings = await database.settings.get(1);
    const firstBike = await database.bikes.toCollection().first();
    if (settings && firstBike && !(await database.bikes.get(settings.activeBikeId))) await database.settings.update(1, { activeBikeId: firstBike.id });
  });
}

export interface MergeResult {
  added: number;
  skipped: number;
}

const lower = (s: string | undefined) => (s ?? '').trim().toLowerCase();

/**
 * Adds the backup's records alongside what's here. Ids are renumbered, and links between
 * records follow. A record already present (same bike, date and key figures) is skipped, so
 * restoring the same backup twice changes nothing the second time.
 */
export async function restoreMerge(database: AppDB, backup: BackupFile): Promise<MergeResult> {
  const t = backup.tables;
  let added = 0;
  let skipped = 0;

  await database.transaction('rw', database.tables, async () => {
    // Bikes, stations and checklist items are matched by name.
    const bikeMap = new Map<number, number>();
    const bikes = await database.bikes.toArray();
    for (const b of t.bikes) {
      const match = bikes.find((x) => lower(x.name) === lower(b.name) && lower(x.registration) === lower(b.registration));
      const { id, ...rest } = b;
      bikeMap.set(id, match ? match.id : await database.bikes.add(rest));
    }

    const stationMap = new Map<number, number>();
    const stations = await database.stations.toArray();
    for (const s of t.stations) {
      const match = stations.find((x) => lower(x.name) === lower(s.name));
      const { id, ...rest } = s;
      stationMap.set(id, match ? match.id : await database.stations.add(rest));
    }

    const typeMap = new Map<number, number>();
    const types = await database.serviceItemTypes.toArray();
    let sortOrder = Math.max(0, ...types.map((x) => x.sortOrder));
    for (const it of t.serviceItemTypes) {
      const match = types.find((x) => lower(x.name) === lower(it.name));
      const { id, ...rest } = it;
      typeMap.set(id, match ? match.id : await database.serviceItemTypes.add({ ...rest, sortOrder: ++sortOrder }));
    }

    // Photos are only copied when the record that owns them is new.
    const photoById = new Map(t.photos.map((p) => [p.id, p]));
    const copyPhoto = async (id: number) => {
      const p = photoById.get(id);
      return p ? database.photos.add({ createdAt: p.createdAt, blob: base64ToBlob(p.data, p.type) }) : undefined;
    };

    // Adds rows that aren't already here. `key` identifies a record by what it says, not its id.
    async function mergeRows<T extends { id: number }>(name: TableName, rows: T[], key: (r: Omit<T, 'id'>) => string, remap: (r: T) => Promise<Omit<T, 'id'>>) {
      const table = database.table(name);
      const existing = new Set(((await table.toArray()) as T[]).map((r) => key(r)));
      const ids = new Map<number, number>();
      for (const row of rows) {
        const mapped = await remap(row);
        const k = key(mapped);
        if (existing.has(k)) {
          skipped++;
          continue;
        }
        existing.add(k);
        ids.set(row.id, (await table.add(mapped)) as number);
        added++;
      }
      return ids;
    }

    const bike = (id: number) => bikeMap.get(id) ?? id;

    await mergeRows<FuelEntry>(
      'fuelEntries',
      t.fuelEntries,
      (r) => `${r.bikeId}|${r.date}|${r.odometer}|${r.litres}|${r.totalCost}`,
      async ({ id: _id, ...r }) => ({ ...r, bikeId: bike(r.bikeId), stationId: r.stationId != null ? stationMap.get(r.stationId) : undefined }),
    );
    await mergeRows<Trip>('trips', t.trips, (r) => `${r.bikeId}|${r.date}|${r.startOdometer}|${r.endOdometer}`, async ({ id: _id, ...r }) => ({ ...r, bikeId: bike(r.bikeId) }));
    await mergeRows<Expense>('expenses', t.expenses, (r) => `${r.bikeId}|${r.date}|${r.category}|${r.amount}|${r.odometer ?? ''}`, async ({ id: _id, ...r }) => ({ ...r, bikeId: bike(r.bikeId) }));

    // Duplicate checks run before photos are copied, so a skipped record never leaves stray photos.
    const accKeys = new Set((await database.accessories.toArray()).map((a) => `${a.bikeId}|${a.date}|${lower(a.name)}|${a.price}`));
    for (const { id: _id, ...a } of t.accessories) {
      const k = `${bike(a.bikeId)}|${a.date}|${lower(a.name)}|${a.price}`;
      if (accKeys.has(k)) {
        skipped++;
        continue;
      }
      accKeys.add(k);
      await database.accessories.add({ ...a, bikeId: bike(a.bikeId), photoId: a.photoId != null ? await copyPhoto(a.photoId) : undefined });
      added++;
    }

    const serviceKeys = new Set((await database.serviceRecords.toArray()).map((s) => `${s.bikeId}|${s.date}|${s.odometer}|${s.totalCost}`));
    for (const s of t.serviceRecords) {
      const k = `${bike(s.bikeId)}|${s.date}|${s.odometer}|${s.totalCost}`;
      if (serviceKeys.has(k)) {
        skipped++;
        continue;
      }
      serviceKeys.add(k);
      const photoIds: number[] = [];
      for (const pid of s.billPhotoIds) {
        const newId = await copyPhoto(pid);
        if (newId != null) photoIds.push(newId);
      }
      const { id, ...rest } = s;
      const recordId = await database.serviceRecords.add({ ...rest, bikeId: bike(s.bikeId), billPhotoIds: photoIds });
      const items = t.serviceItems.filter((i) => i.serviceRecordId === id);
      await database.serviceItems.bulkAdd(items.map(({ id: _i, ...i }) => ({ ...i, serviceRecordId: recordId, itemTypeId: typeMap.get(i.itemTypeId) ?? i.itemTypeId })));
      added++;
    }

    const policyMap = new Map<number, number>();
    const policyKeys = new Set((await database.insurancePolicies.toArray()).map((p) => `${p.bikeId}|${lower(p.insurer)}|${p.startDate}|${p.endDate}`));
    for (const p of t.insurancePolicies) {
      const k = `${bike(p.bikeId)}|${lower(p.insurer)}|${p.startDate}|${p.endDate}`;
      if (policyKeys.has(k)) {
        skipped++;
        continue;
      }
      policyKeys.add(k);
      const { id, ...rest } = p;
      policyMap.set(id, await database.insurancePolicies.add({ ...rest, bikeId: bike(p.bikeId), photoId: p.photoId != null ? await copyPhoto(p.photoId) : undefined }));
      added++;
    }

    await mergeRows<ReminderRule>(
      'reminderRules',
      t.reminderRules,
      (r) => `${r.bikeId}|${lower(r.title)}|${r.type}`,
      async ({ id: _id, ...r }) => ({
        ...r,
        bikeId: bike(r.bikeId),
        linkedItemTypeId: r.linkedItemTypeId != null ? typeMap.get(r.linkedItemTypeId) : undefined,
        linkedPolicyId: r.linkedPolicyId != null ? policyMap.get(r.linkedPolicyId) : undefined,
      }),
    );
  });

  return { added, skipped };
}
