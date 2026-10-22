import { db } from './index';
import type { Accessory, Expense, FuelEntry, ServiceRecord, Trip } from './types';
import { getOdometerReadings } from './odometer';
import { latestOdometer } from '../lib/calc/odometer';
import { totalFrom, round } from '../lib/calc/fuel';
import { todayISO } from '../lib/format';
import { addDays, addMonths } from '../lib/reminders/evaluate';

// Small seeded random generator, so sample data is the same every time.
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Dev only: about a year of fill-ups, ending today, continuing from the current odometer. */
export async function loadSampleFuel(bikeId: number, count = 45, car = false) {
  const rnd = random(42);
  const outlets: [string, string][] = [
    ['IndianOil, MG Road', 'iocl'],
    ['HP, Ring Road', 'hpcl'],
    ['BPCL, Hosur Highway', 'bpcl'],
  ];
  const stationIds: number[] = [];
  const stationBrand = new Map<number, string>();
  for (const [name, brand] of outlets) {
    const existing = await db.stations.where('name').equals(name).first();
    const id = existing ? existing.id : await db.stations.add({ name, brand });
    stationIds.push(id);
    stationBrand.set(id, brand);
  }
  // Mostly regular petrol, now and then a premium grade from the same company.
  const premium: Record<string, string> = { iocl: 'xp95', hpcl: 'power99', bpcl: 'speed97' };
  const ridingMix = [['city'], ['city'], ['highway'], ['mixed'], ['hills'], ['city', 'highway'], ['offroad']];

  let odometer = (latestOdometer(await getOdometerReadings(bikeId)) ?? 10000) + 50;
  const day = 24 * 60 * 60 * 1000;
  const start = Date.now() - count * 8 * day;
  const entries = [];

  for (let i = 0; i < count; i++) {
    // Roughly a Himalayan 450 (26-32 km/l, 250-400 km a fill) or a hatchback (15-21 km/l).
    const distance = car ? Math.round(300 + rnd() * 250) : Math.round(250 + rnd() * 150);
    const conditions = ridingMix[Math.floor(rnd() * ridingMix.length)];
    // Highways and city riding differ, so the sample shows it in "Mileage by riding".
    const bias = conditions.includes('highway') ? 2.5 : conditions.includes('offroad') || conditions.includes('hills') ? -3 : 0;
    const kmPerLitre = (car ? 15 + rnd() * 6 : 26 + rnd() * 6) + (car ? bias / 2 : bias);
    const isFullTank = i === 0 || rnd() > 0.2;
    const litres = round(distance / kmPerLitre, 2);
    const price = round(103 + rnd() * 3, 2);
    odometer += distance;
    const stationId = stationIds[Math.floor(rnd() * stationIds.length)];
    entries.push({
      bikeId,
      date: todayISO(new Date(start + i * 8 * day)),
      odometer,
      litres,
      pricePerLitre: price,
      totalCost: totalFrom(litres, price),
      isFullTank,
      stationId,
      brand: stationBrand.get(stationId),
      fuelType: rnd() < 0.2 ? premium[stationBrand.get(stationId)!] : 'petrol',
      conditions: car ? conditions.filter((c) => c !== 'offroad') : conditions,
      notes: '',
    });
  }
  await db.fuelEntries.bulkAdd(entries);
  return entries;
}

/** Dev only: fill-ups plus a year of services laid along the same odometer readings. */
export async function loadSampleData(bikeId: number) {
  const fills = await loadSampleFuel(bikeId);
  const types = await db.serviceItemTypes.toArray();
  const typeId = (name: string) => types.find((t) => t.name === name)!.id;

  // [fill index, centre, labour, items as [name, cost]]
  const plan: [number, string, number, [string, number][]][] = [
    [6, 'Home', 0, [['Chain clean and lube', 250]]],
    [13, 'Home', 0, [['Chain clean and lube', 250], ['Washing', 150]]],
    [20, 'RE Service, Indiranagar', 900, [['Engine oil', 1850], ['Oil filter', 380], ['Air filter', 650], ['Chain clean and lube', 0], ['General service', 0]]],
    [27, 'Home', 0, [['Chain clean and lube', 250]]],
    [33, 'RE Service, Indiranagar', 300, [['Rear brake pads', 950], ['Washing', 150]]],
    [40, 'Home', 0, [['Chain clean and lube', 250]]],
  ];
  let count = 0;
  for (const [index, centre, labour, items] of plan) {
    const fill = fills[index];
    if (!fill) continue;
    const itemTotal = items.reduce((sum, [, cost]) => sum + cost, 0);
    const recordId = await db.serviceRecords.add({
      bikeId,
      date: fill.date,
      odometer: fill.odometer + 5,
      serviceCenter: centre,
      laborCost: labour,
      totalCost: itemTotal + labour,
      notes: '',
      billPhotoIds: [],
    });
    await db.serviceItems.bulkAdd(items.map(([name, cost]) => ({ serviceRecordId: recordId, itemTypeId: typeId(name), cost: cost || undefined })));
    count++;
  }

  // A few rides, accessories and running costs along the same readings.
  const trips: [number, number, string, string[]][] = [
    [3, 42, 'Office and back', ['Commute']],
    [9, 180, 'Nandi Hills sunrise', ['Ride']],
    [17, 610, 'Bengaluru to Coorg', ['Long trip', 'Ride']],
    [25, 38, 'Office and back', ['Commute']],
    [36, 920, 'Bengaluru to Goa', ['Long trip']],
  ];
  for (const [index, distance, purpose, tags] of trips) {
    const fill = fills[index];
    if (fill) await db.trips.add({ bikeId, date: fill.date, startOdometer: fill.odometer, endOdometer: fill.odometer + distance, purpose, tags, notes: '' });
  }

  const at = (index: number) => fills[Math.min(index, fills.length - 1)];
  await db.accessories.bulkAdd([
    { bikeId, date: at(1).date, name: 'Crash guard', category: 'protection', price: 4500, shop: 'RE Service, Indiranagar', odometer: at(1).odometer, notes: '' },
    { bikeId, date: at(1).date, name: 'Phone mount', category: 'electronics', price: 1200, shop: 'Riders Hub', notes: '' },
    { bikeId, date: at(16).date, name: 'Saddle stays and bags', category: 'luggage', price: 6800, shop: 'Riders Hub', notes: 'Before the Coorg trip' },
    { bikeId, date: at(30).date, name: 'Touring seat', category: 'comfort', price: 5200, shop: 'RE Service, Indiranagar', notes: '' },
  ]);
  await db.expenses.bulkAdd([
    { bikeId, date: at(2).date, category: 'puc', amount: 100, notes: '' },
    { bikeId, date: at(17).date, category: 'toll', amount: 340, notes: 'Coorg trip' },
    { bikeId, date: at(22).date, category: 'parking', amount: 40, notes: 'Mall' },
    { bikeId, date: at(36).date, category: 'toll', amount: 620, notes: 'Goa trip' },
    { bikeId, date: at(38).date, category: 'fine', amount: 500, notes: 'Parking' },
    { bikeId, date: at(fills.length - 2).date, category: 'parking', amount: 30, notes: '' },
    { bikeId, date: at(fills.length - 1).date, category: 'wash', amount: 200, notes: '' },
  ]);

  // Reminders: oil from the full service, chain from the last lube, and two documents.
  const oilAt = fills[20];
  const chainAt = fills[40];
  await db.reminderRules.bulkAdd([
    { bikeId, title: 'Engine oil', type: 'serviceItem', linkedItemTypeId: typeId('Engine oil'), dueOdometer: oilAt.odometer + 5 + 10000, dueDate: addMonths(oilAt.date, 12), repeatKm: 10000, repeatMonths: 12, active: true },
    { bikeId, title: 'Chain clean and lube', type: 'serviceItem', linkedItemTypeId: typeId('Chain clean and lube'), dueOdometer: chainAt.odometer + 5 + 500, repeatKm: 500, active: true },
    { bikeId, title: 'PUC certificate', type: 'puc', dueDate: addMonths(at(2).date, 12), repeatMonths: 12, active: true },
  ]);

  const policyStart = at(0).date;
  const policyId = await db.insurancePolicies.add({
    bikeId,
    insurer: 'ICICI Lombard',
    policyNumber: '3005/2A/1234567',
    cover: 'comprehensive',
    startDate: policyStart,
    endDate: addDays(addMonths(policyStart, 12), -1),
    premium: 9200,
    frequency: 'once',
    idv: 265000,
    ncbPercent: 20,
    addOns: ['Zero depreciation', 'Roadside assistance'],
    contact: 'Helpline 1800 2666',
    notes: '',
  });
  await db.reminderRules.add({ bikeId, title: 'Insurance renewal (ICICI Lombard)', type: 'insurance', linkedPolicyId: policyId, policyEvent: 'renewal', alertDays: 2, active: true });
  await db.bikes.update(bikeId, { purchasePrice: 315000, purchaseDate: addDays(at(0).date, -20) });

  const car = await loadSampleCar();
  return { fills: fills.length + car.fills, services: count + car.services, trips: trips.length, accessories: 4, expenses: 7, reminders: 4, vehicles: 2 };
}

/** Dev only: a second vehicle, a hatchback, so Reports can show all vehicles together. */
async function loadSampleCar() {
  const carId = await db.bikes.add({
    name: 'Family car',
    kind: 'car',
    fuelKind: 'petrol',
    make: 'Maruti Suzuki',
    model: 'Baleno',
    registration: 'KA 05 MN 4321',
    purchaseOdometer: 0,
    purchasePrice: 850000,
    tankCapacity: 37,
    notes: '',
  });
  const fills = await loadSampleFuel(carId, 24, true);
  const types = await db.serviceItemTypes.toArray();
  const typeId = (name: string) => types.find((t) => t.name === name)!.id;
  const plan: [number, number, [string, number][]][] = [
    [8, 1200, [['Engine oil', 2600], ['Oil filter', 350], ['AC service', 900], ['Wheel alignment and balancing', 600]]],
    [20, 800, [['General service', 0], ['Cabin air filter', 450], ['Wiper blades', 700]]],
  ];
  for (const [i, labour, items] of plan) {
    const f = fills[i];
    const id = await db.serviceRecords.add({ bikeId: carId, date: f.date, odometer: f.odometer + 3, serviceCenter: 'Nexa Service', laborCost: labour, totalCost: labour + items.reduce((s, [, c]) => s + c, 0), notes: '', billPhotoIds: [] });
    await db.serviceItems.bulkAdd(items.map(([name, cost]) => ({ serviceRecordId: id, itemTypeId: typeId(name), cost: cost || undefined })));
  }
  const start = fills[0].date;
  const policyId = await db.insurancePolicies.add({
    bikeId: carId,
    insurer: 'HDFC ERGO',
    policyNumber: '2311 2026 9988',
    cover: 'comprehensive',
    startDate: start,
    endDate: addDays(addMonths(start, 12), -1),
    premium: 1650,
    frequency: 'monthly',
    idv: 640000,
    ncbPercent: 25,
    addOns: ['Zero depreciation', 'Engine protection', 'Return to invoice'],
    contact: '',
    notes: 'Paid monthly by auto-debit',
  });
  await db.reminderRules.bulkAdd([
    { bikeId: carId, title: 'Insurance premium (HDFC ERGO)', type: 'insurance', linkedPolicyId: policyId, policyEvent: 'premium', repeatMonths: 1, alertDays: 2, active: true },
    { bikeId: carId, title: 'Insurance renewal (HDFC ERGO)', type: 'insurance', linkedPolicyId: policyId, policyEvent: 'renewal', alertDays: 2, active: true },
  ]);
  return { fills: fills.length, services: plan.length };
}

/**
 * Dev only: a stress test with a few thousand records over four years, to check the app stays
 * quick. Not realistic riding, just volume.
 */
export async function loadStressData(bikeId: number) {
  const rnd = random(7);
  const day = 86_400_000;
  const days = 4 * 365;
  const start = Date.now() - days * day;
  let odometer = (latestOdometer(await getOdometerReadings(bikeId)) ?? 0) + 10;
  const stationIds = await db.stations.bulkAdd(
    Array.from({ length: 12 }, (_, i) => ({ name: `Stress station ${i + 1}` })),
    { allKeys: true },
  );
  const types = await db.serviceItemTypes.toArray();

  const fuel: Omit<FuelEntry, 'id'>[] = [];
  const trips: Omit<Trip, 'id'>[] = [];
  const expenses: Omit<Expense, 'id'>[] = [];
  const services: Omit<ServiceRecord, 'id'>[] = [];
  const accessories: Omit<Accessory, 'id'>[] = [];
  for (let d = 0; d < days; d++) {
    const date = todayISO(new Date(start + d * day));
    const ridden = Math.round(20 + rnd() * 60);
    if (rnd() < 0.6) trips.push({ bikeId, date, startOdometer: odometer, endOdometer: odometer + ridden, purpose: 'Stress ride', tags: ['Commute'], notes: '' });
    odometer += ridden;
    if (rnd() < 0.85) {
      const litres = round(ridden / (26 + rnd() * 6), 2);
      const price = round(100 + rnd() * 8, 2);
      fuel.push({ bikeId, date, odometer, litres, pricePerLitre: price, totalCost: totalFrom(litres, price), isFullTank: rnd() > 0.15, stationId: stationIds[Math.floor(rnd() * stationIds.length)], notes: '' });
    }
    if (rnd() < 0.2) expenses.push({ bikeId, date, category: 'parking', amount: Math.round(20 + rnd() * 80), notes: '' });
    if (d % 4 === 0) services.push({ bikeId, date, odometer: odometer + 1, serviceCenter: 'Stress garage', laborCost: 200, totalCost: 700, notes: '', billPhotoIds: [] });
    if (d % 15 === 0) accessories.push({ bikeId, date, name: `Part ${d}`, category: 'other', price: Math.round(300 + rnd() * 3000), shop: 'Stress shop', notes: '' });
  }

  await db.transaction('rw', [db.fuelEntries, db.trips, db.expenses, db.serviceRecords, db.serviceItems, db.accessories], async () => {
    await db.fuelEntries.bulkAdd(fuel);
    await db.trips.bulkAdd(trips);
    await db.expenses.bulkAdd(expenses);
    await db.accessories.bulkAdd(accessories);
    const ids = await db.serviceRecords.bulkAdd(services, { allKeys: true });
    await db.serviceItems.bulkAdd(ids.flatMap((serviceRecordId, i) => [0, 1, 2].map((k) => ({ serviceRecordId, itemTypeId: types[(i + k * 5) % types.length].id, cost: 150 }))));
  });
  const serviceItems = services.length * 3;
  return { total: fuel.length + trips.length + expenses.length + services.length + accessories.length + serviceItems };
}
