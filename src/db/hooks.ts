import { useLiveQuery } from 'dexie-react-hooks';
import { unitsFor } from '../lib/units';
import { db } from './index';

export function useSettings() {
  return useLiveQuery(() => db.settings.get(1), []);
}

export function useActiveBike() {
  const settings = useSettings();
  const bikeId = settings?.activeBikeId;
  return useLiveQuery(() => (bikeId ? db.bikes.get(bikeId) : undefined), [bikeId]);
}

/** Unit labels for the active vehicle. */
export function useUnits() {
  const settings = useSettings();
  const bike = useActiveBike();
  return settings ? unitsFor(settings, bike) : undefined;
}
