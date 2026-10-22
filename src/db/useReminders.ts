import { useLiveQuery } from 'dexie-react-hooks';
import { loadReminders } from './reminderData';

/**
 * Active reminders with their status, most urgent first. Live, so it re-evaluates the moment
 * any odometer reading, policy or reminder is saved, and every time the app opens.
 */
export function useReminders(bikeId: number | undefined) {
  return useLiveQuery(async () => (bikeId ? (await loadReminders(bikeId)).active : undefined), [bikeId]);
}
