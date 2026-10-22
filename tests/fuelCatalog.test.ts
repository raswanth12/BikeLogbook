import { describe, expect, it } from 'vitest';
import { brandsFor, FUEL_TYPES, fuelTypesFor, regularFuel } from '../src/lib/fuelCatalog';
import { unitsFor } from '../src/lib/units';
import type { Settings } from '../src/db/types';

describe('fuel catalog', () => {
  it('offers each brand its own premium grades plus the regular one', () => {
    expect(fuelTypesFor('petrol', 'iocl').map((t) => t.name)).toEqual(['Petrol (E20)', 'XP95', 'XP100']);
    expect(fuelTypesFor('petrol', 'bpcl').map((t) => t.name)).toEqual(['Petrol (E20)', 'Speed', 'Speed 97']);
    expect(fuelTypesFor('petrol', 'hpcl').map((t) => t.name)).toEqual(['Petrol (E20)', 'Power 95', 'Power 99', 'Power 100']);
    expect(fuelTypesFor('petrol', 'shell').map((t) => t.name)).toContain('V-Power');
  });

  it('keeps diesel and CNG apart from petrol', () => {
    expect(fuelTypesFor('diesel', 'iocl').map((t) => t.key)).toEqual(['diesel', 'xtragreen']);
    expect(fuelTypesFor('cng').map((t) => t.key)).toEqual(['cng']);
    expect(brandsFor('petrol').some((b) => b.key === 'citygas')).toBe(false);
    expect(brandsFor('cng').some((b) => b.key === 'citygas')).toBe(true);
  });

  it('has unique keys and a regular grade for every fuel', () => {
    expect(new Set(FUEL_TYPES.map((t) => t.key)).size).toBe(FUEL_TYPES.length);
    for (const kind of ['petrol', 'diesel', 'cng'] as const) expect(FUEL_TYPES.some((t) => t.key === regularFuel(kind))).toBe(true);
  });

  it('measures CNG in kilograms', () => {
    const s = { currencySymbol: '₹', distanceUnit: 'km', fuelUnit: 'L', mileageUnit: 'km/l' } as Settings;
    expect(unitsFor(s, { fuelKind: 'petrol' })).toMatchObject({ fuel: 'L', mileage: 'km/l' });
    expect(unitsFor(s, { fuelKind: 'cng' })).toMatchObject({ fuel: 'kg', mileage: 'km/kg' });
  });
});
