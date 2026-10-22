import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './index';
import { getOdometerReadings } from './odometer';

/** Everything the service screens need for one bike, kept live. */
export function useServiceData(bikeId: number | undefined) {
  return useLiveQuery(async () => {
    if (!bikeId) return undefined;
    const [records, itemTypes, readings] = await Promise.all([
      db.serviceRecords.where('bikeId').equals(bikeId).toArray(),
      db.serviceItemTypes.orderBy('sortOrder').toArray(),
      getOdometerReadings(bikeId),
    ]);
    const items = records.length ? await db.serviceItems.where('serviceRecordId').anyOf(records.map((r) => r.id)).toArray() : [];
    return { records, itemTypes, items, readings };
  }, [bikeId]);
}
