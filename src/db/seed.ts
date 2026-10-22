import type { ServiceCategory, ServiceItemType, VehicleKind } from './types';

const TWO_WHEEL: VehicleKind[] = ['motorcycle', 'scooter'];
const BIKE: VehicleKind[] = ['motorcycle'];
const SCOOTER: VehicleKind[] = ['scooter'];
const CAR: VehicleKind[] = ['car'];

// [name, category, interval km, interval months, vehicle types (missing = all)].
// Two-wheeler intervals are set for a Royal Enfield Himalayan 450 (10,000 km / 12 month
// service, liquid-cooled); car items use common Indian service schedules. Check them against
// your owner's manual and edit in Settings. Blank interval means "replace when worn".
type Seed = [string, ServiceCategory, number?, number?, VehicleKind[]?];

const CATALOG: Seed[] = [
  ['Engine oil', 'engine', 10000, 12],
  ['Oil filter', 'engine', 10000, 12],
  ['Air filter', 'engine', 10000, 12],
  ['Spark plug', 'engine', 20000, 24],
  ['Chain clean and lube', 'chain', 500, undefined, BIKE],
  ['Chain sprocket kit', 'chain', 20000, undefined, BIKE],
  ['Front brake pads', 'brakes', 10000],
  ['Rear brake pads', 'brakes', 10000],
  ['Brake fluid', 'brakes', undefined, 24],
  ['Clutch cable', 'chain', undefined, undefined, BIKE],
  ['Clutch plate', 'chain', undefined, undefined, ['motorcycle', 'car']],
  ['Coolant', 'engine', 36000, 36],
  ['Battery', 'electrical', undefined, 36],
  ['Front tyre', 'tyres', 20000, 60, TWO_WHEEL],
  ['Rear tyre', 'tyres', 15000, 60, TWO_WHEEL],
  ['Tube', 'tyres', undefined, undefined, TWO_WHEEL],
  ['Fork oil', 'general', 20000, 24, TWO_WHEEL],
  ['General service', 'general', 10000, 12],
  ['Washing', 'general'],
  ['Other', 'general'],
  // Added with multi-vehicle support.
  ['CVT belt', 'chain', 20000, undefined, SCOOTER],
  ['Roller weights', 'chain', 20000, undefined, SCOOTER],
  ['Gearbox oil', 'chain', 40000, 48, CAR],
  ['Fuel filter', 'engine', 40000, 48, CAR],
  ['Timing belt', 'engine', 60000, 60, CAR],
  ['Drive belt', 'engine', 40000, 48, CAR],
  ['Cabin air filter', 'engine', 15000, 12, CAR],
  ['Front tyres', 'tyres', 40000, 60, CAR],
  ['Rear tyres', 'tyres', 40000, 60, CAR],
  ['Tyre rotation', 'tyres', 10000, undefined, CAR],
  ['Wheel alignment and balancing', 'tyres', 10000, 12, CAR],
  ['AC service', 'electrical', undefined, 12, CAR],
  ['AC gas refill', 'electrical', undefined, undefined, CAR],
  ['Wiper blades', 'general', undefined, 12, CAR],
];

export function defaultInterval(name: string): { km?: number; months?: number } {
  const seed = CATALOG.find(([n]) => n === name);
  return seed ? { km: seed[2], months: seed[3] } : {};
}

export function defaultKinds(name: string): VehicleKind[] | undefined {
  return CATALOG.find(([n]) => n === name)?.[4];
}

export function seedServiceItemTypes(): Omit<ServiceItemType, 'id'>[] {
  return CATALOG.map(([name, category, km, months, kinds], i) => ({
    name,
    category,
    defaultIntervalKm: km,
    defaultIntervalMonths: months,
    kinds,
    isCustom: false,
    hidden: false,
    sortOrder: i,
  }));
}

/** True when the checklist item applies to this kind of vehicle. */
export function itemFitsVehicle(item: { kinds?: VehicleKind[] }, kind: VehicleKind | undefined): boolean {
  return !item.kinds || item.kinds.includes(kind ?? 'motorcycle');
}
