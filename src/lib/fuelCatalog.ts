import type { FuelKind } from '../db/types';

export interface FuelBrand {
  key: string;
  name: string;
  short: string;
  /** Only offered for these fuels. Missing means all. */
  kinds?: FuelKind[];
}

// India's fuel retailers, biggest networks first (late-2025 outlet counts: IndianOil ~41,700,
// BPCL ~24,600, HPCL ~24,400, Nayara ~6,900, Jio-bp ~2,100, Shell ~350).
export const FUEL_BRANDS: FuelBrand[] = [
  { key: 'iocl', name: 'IndianOil', short: 'IndianOil' },
  { key: 'bpcl', name: 'Bharat Petroleum', short: 'BPCL' },
  { key: 'hpcl', name: 'Hindustan Petroleum', short: 'HPCL' },
  { key: 'nayara', name: 'Nayara Energy', short: 'Nayara' },
  { key: 'jiobp', name: 'Jio-bp', short: 'Jio-bp' },
  { key: 'shell', name: 'Shell', short: 'Shell' },
  { key: 'citygas', name: 'City gas (IGL, MGL, Gujarat Gas…)', short: 'City gas', kinds: ['cng'] },
  { key: 'other', name: 'Other', short: 'Other' },
];

export interface FuelType {
  key: string;
  name: string;
  kind: FuelKind;
  /** Brands that sell it. Missing means every brand. */
  brands?: string[];
  note?: string;
}

// Octane and ethanol figures are as the companies advertise them; blends change over time.
export const FUEL_TYPES: FuelType[] = [
  { key: 'petrol', name: 'Petrol (E20)', kind: 'petrol', note: 'Regular petrol, up to 20% ethanol' },
  { key: 'petrol-e10', name: 'Petrol (E10)', kind: 'petrol', brands: ['jiobp', 'nayara', 'shell', 'other'], note: 'Lower-ethanol petrol, where sold' },
  { key: 'xp95', name: 'XP95', kind: 'petrol', brands: ['iocl'], note: '95 octane premium' },
  { key: 'xp100', name: 'XP100', kind: 'petrol', brands: ['iocl'], note: '100 octane, ethanol-free' },
  { key: 'speed', name: 'Speed', kind: 'petrol', brands: ['bpcl'], note: 'Premium petrol' },
  { key: 'speed97', name: 'Speed 97', kind: 'petrol', brands: ['bpcl'], note: '97 octane premium' },
  { key: 'power95', name: 'Power 95', kind: 'petrol', brands: ['hpcl'], note: '95 octane premium' },
  { key: 'power99', name: 'Power 99', kind: 'petrol', brands: ['hpcl'], note: '99 octane premium' },
  { key: 'power100', name: 'Power 100', kind: 'petrol', brands: ['hpcl'], note: '100 octane premium' },
  { key: 'vpower', name: 'V-Power', kind: 'petrol', brands: ['shell'], note: 'Premium petrol' },
  { key: 'premium-petrol', name: 'Premium petrol', kind: 'petrol', brands: ['nayara', 'jiobp', 'other'] },
  { key: 'diesel', name: 'Diesel', kind: 'diesel', note: 'Regular diesel' },
  { key: 'xtragreen', name: 'XtraGreen', kind: 'diesel', brands: ['iocl'], note: 'Premium diesel' },
  { key: 'speed-diesel', name: 'Speed Diesel', kind: 'diesel', brands: ['bpcl'], note: 'Premium diesel' },
  { key: 'turbojet', name: 'Turbojet', kind: 'diesel', brands: ['hpcl'], note: 'Premium diesel' },
  { key: 'premium-diesel', name: 'Premium diesel', kind: 'diesel', brands: ['nayara', 'jiobp', 'shell', 'other'] },
  { key: 'cng', name: 'CNG', kind: 'cng' },
];

export function brandsFor(kind: FuelKind): FuelBrand[] {
  return FUEL_BRANDS.filter((b) => !b.kinds || b.kinds.includes(kind));
}

/** Fuel types a brand sells for this kind of vehicle, regular grade first. */
export function fuelTypesFor(kind: FuelKind, brand?: string): FuelType[] {
  return FUEL_TYPES.filter((t) => t.kind === kind && (!brand || !t.brands || t.brands.includes(brand)));
}

/** The everyday grade for a fuel: Petrol (E20), Diesel or CNG. */
export function regularFuel(kind: FuelKind): string {
  return kind === 'petrol' ? 'petrol' : kind;
}

export const brandName = (key?: string) => FUEL_BRANDS.find((b) => b.key === key)?.name ?? '';
export const brandShort = (key?: string) => FUEL_BRANDS.find((b) => b.key === key)?.short ?? '';
export const fuelTypeName = (key?: string) => FUEL_TYPES.find((t) => t.key === key)?.name ?? '';
