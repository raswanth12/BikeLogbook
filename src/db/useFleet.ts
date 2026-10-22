import { useLiveQuery } from 'dexie-react-hooks';
import { insurancePayments } from '../lib/calc/insurance';
import type { ReportInput } from '../lib/calc/periods';
import { todayISO } from '../lib/format';
import { db } from './index';
import { getOdometerReadings } from './odometer';
import type { Bike } from './types';

/** Every vehicle with its records, ready for buildReport, for the all-vehicles totals. */
export function useFleet() {
  return useLiveQuery(async () => {
    const [bikes, fuel, trips, services, accessories, expenses, policies] = await Promise.all([
      db.bikes.toArray(),
      db.fuelEntries.toArray(),
      db.trips.toArray(),
      db.serviceRecords.toArray(),
      db.accessories.toArray(),
      db.expenses.toArray(),
      db.insurancePolicies.toArray(),
    ]);
    const today = todayISO();
    const out: { bike: Bike; input: ReportInput }[] = [];
    for (const bike of bikes) {
      const mine = <T extends { bikeId: number }>(list: T[]) => list.filter((r) => r.bikeId === bike.id);
      out.push({
        bike,
        input: {
          fuel: mine(fuel),
          trips: mine(trips),
          services: mine(services),
          accessories: mine(accessories),
          expenses: mine(expenses),
          insurance: insurancePayments(mine(policies), today),
          readings: await getOdometerReadings(bike.id),
        },
      });
    }
    return out;
  }, []);
}
