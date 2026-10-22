import type { Settings } from '../../db/types';
import { daysBetween } from '../calc/service';

const INTERVAL_DAYS = { weekly: 7, monthly: 30 } as const;

/** True when the chosen backup interval has passed since the last backup (or there's never been one). */
export function backupDue(settings: Pick<Settings, 'backupFrequency' | 'lastBackupDate'>, today: string): boolean {
  const freq = settings.backupFrequency ?? 'monthly';
  if (freq === 'off') return false;
  if (!settings.lastBackupDate) return true;
  return daysBetween(settings.lastBackupDate, today) >= INTERVAL_DAYS[freq];
}

/** Ask on launch at most once a day, and only once there's something worth saving. */
export function shouldPrompt(settings: Pick<Settings, 'backupFrequency' | 'lastBackupDate' | 'backupPromptDate'>, today: string, hasData: boolean): boolean {
  return hasData && backupDue(settings, today) && settings.backupPromptDate !== today;
}
