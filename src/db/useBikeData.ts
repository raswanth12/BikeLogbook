import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './index';
import { getOdometerReadings } from './odometer';
import { insurancePayments } from '../lib/calc/insurance';
import { todayISO } from '../lib/format';

/** Every record for one bike, kept live. Small enough to load whole for a personal logbook. */
export function useBikeData(bikeId: number | undefined) {
  return useLiveQuery(async () => {
    if (!bikeId) return undefined;
    const [fuel, trips, services, accessories, expenses, itemTypes, readings, policies, bike] = await Promise.all([
      db.fuelEntries.where('bikeId').equals(bikeId).toArray(),
      db.trips.where('bikeId').equals(bikeId).toArray(),
      db.serviceRecords.where('bikeId').equals(bikeId).toArray(),
      db.accessories.where('bikeId').equals(bikeId).toArray(),
      db.expenses.where('bikeId').equals(bikeId).toArray(),
      db.serviceItemTypes.toArray(),
      getOdometerReadings(bikeId),
      db.insurancePolicies.where('bikeId').equals(bikeId).toArray(),
      db.bikes.get(bikeId),
    ]);
    const serviceItems = services.length ? await db.serviceItems.where('serviceRecordId').anyOf(services.map((s) => s.id)).toArray() : [];
    // Premiums count as spent once their payment date has passed.
    const insurance = insurancePayments(policies, todayISO());
    return { fuel, trips, services, serviceItems, accessories, expenses, itemTypes, readings, policies, insurance, bike };
  }, [bikeId]);
}

export type BikeData = NonNullable<ReturnType<typeof useBikeData>>;
