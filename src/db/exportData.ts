import type { ExportData } from '../lib/export/xlsx';
import { db } from './index';
import { getOdometerReadings } from './odometer';

/** Everything the Excel export needs for one bike, read once at export time. */
export async function loadExportData(bikeId: number): Promise<ExportData> {
  const [bike, settings, stations, fuel, trips, services, itemTypes, accessories, expenses, readings, policies] = await Promise.all([
    db.bikes.get(bikeId),
    db.settings.get(1),
    db.stations.toArray(),
    db.fuelEntries.where('bikeId').equals(bikeId).toArray(),
    db.trips.where('bikeId').equals(bikeId).toArray(),
    db.serviceRecords.where('bikeId').equals(bikeId).toArray(),
    db.serviceItemTypes.toArray(),
    db.accessories.where('bikeId').equals(bikeId).toArray(),
    db.expenses.where('bikeId').equals(bikeId).toArray(),
    getOdometerReadings(bikeId),
    db.insurancePolicies.where('bikeId').equals(bikeId).toArray(),
  ]);
  if (!bike || !settings) throw new Error('No bike to export.');
  const serviceItems = services.length ? await db.serviceItems.where('serviceRecordId').anyOf(services.map((s) => s.id)).toArray() : [];
  return { bike, settings, stations, fuel, trips, services, serviceItems, itemTypes, accessories, expenses, readings, policies };
}
