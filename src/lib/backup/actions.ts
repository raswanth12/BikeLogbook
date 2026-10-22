import { db } from '../../db';
import type { Settings } from '../../db/types';
import { backupFileName, createBackup } from '../export/backup';
import { todayISO } from '../format';
import { shareOrDownload } from '../share';
import { ensureFolder, getToken, uploadBackup } from './googleDrive';

/**
 * Saves a backup through the share sheet: choose Save to Files > iCloud Drive (or anywhere).
 * Returns a message to show, or '' if you cancelled.
 */
export async function backupToFiles(): Promise<string> {
  const today = todayISO();
  const file = new File([JSON.stringify(await createBackup(db))], backupFileName(today), { type: 'application/json' });
  const result = await shareOrDownload(file);
  if (result === 'cancelled') return '';
  await db.settings.update(1, { lastBackupDate: today, backupPromptDate: today });
  return `Saved ${file.name} (${Math.round(file.size / 1024)} KB). Keep it in iCloud Drive or another place off this phone.`;
}

/**
 * Uploads a backup to the "Bike Logbook Backups" folder in Google Drive. Call it straight
 * from a tap: the first step may open Google's sign-in window.
 */
export async function backupToDrive(settings: Settings): Promise<string> {
  if (!settings.googleClientId) throw new Error('Set up Google Drive first.');
  const token = await getToken(settings.googleClientId); // runs before any other await, inside the tap
  const folderId = await ensureFolder(token, settings.driveFolderId);
  const today = todayISO();
  const uploaded = await uploadBackup(token, folderId, backupFileName(today), JSON.stringify(await createBackup(db)));
  await db.settings.update(1, { lastBackupDate: today, backupPromptDate: today, lastDriveBackup: uploaded.createdTime, driveFolderId: folderId });
  return `Backed up to Google Drive as ${uploaded.name}.`;
}
