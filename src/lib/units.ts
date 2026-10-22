import type { Bike, Settings } from '../db/types';

export interface Units {
  currency: string;
  distance: string;
  fuel: string;
  mileage: string;
}

/** Unit labels for a vehicle. CNG is sold by the kilogram, so it shows kg and km/kg. */
export function unitsFor(settings: Settings, vehicle?: Pick<Bike, 'fuelKind'>): Units {
  const cng = vehicle?.fuelKind === 'cng';
  return {
    currency: settings.currencySymbol,
    distance: settings.distanceUnit,
    fuel: cng ? 'kg' : settings.fuelUnit,
    mileage: cng ? `${settings.distanceUnit}/kg` : settings.mileageUnit,
  };
}
