import { db } from './index';
import type { OdometerReading } from '../lib/calc/odometer';

/** Every odometer value recorded for a bike, from all record types. */
export async function getOdometerReadings(bikeId: number): Promise<OdometerReading[]> {
  const [bike, fuel, trips, services, accessories, expenses] = await Promise.all([
    db.bikes.get(bikeId),
    db.fuelEntries.where('bikeId').equals(bikeId).toArray(),
    db.trips.where('bikeId').equals(bikeId).toArray(),
    db.serviceRecords.where('bikeId').equals(bikeId).toArray(),
    db.accessories.where('bikeId').equals(bikeId).toArray(),
    db.expenses.where('bikeId').equals(bikeId).toArray(),
  ]);

  const readings: OdometerReading[] = [];
  if (bike && bike.purchaseOdometer > 0) {
    readings.push({ source: 'purchase', id: bike.id, date: bike.purchaseDate ?? '0000-01-01', odometer: bike.purchaseOdometer });
  }
  for (const f of fuel) readings.push({ source: 'fuel', id: f.id, date: f.date, odometer: f.odometer });
  for (const t of trips) readings.push({ source: 'trip', id: t.id, date: t.date, odometer: t.endOdometer });
  for (const s of services) readings.push({ source: 'service', id: s.id, date: s.date, odometer: s.odometer });
  for (const a of accessories) {
    if (a.odometer != null) readings.push({ source: 'accessory', id: a.id, date: a.date, odometer: a.odometer });
  }
  for (const e of expenses) {
    if (e.odometer != null) readings.push({ source: 'expense', id: e.id, date: e.date, odometer: e.odometer });
  }
  return readings;
}
