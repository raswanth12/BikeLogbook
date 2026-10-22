import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../db';
import { useSettings } from '../db/hooks';
import { backupToDrive, backupToFiles } from '../lib/backup/actions';
import { preloadGoogle } from '../lib/backup/googleDrive';
import { shouldPrompt } from '../lib/backup/schedule';
import { todayISO } from '../lib/format';

/**
 * When a weekly or monthly backup is due, asks once on opening the app. A web app can't run
 * in the background on iPhone, so this tap is how the scheduled backup happens.
 */
export default function BackupPrompt() {
  const settings = useSettings();
  const hasData = useLiveQuery(async () => (await db.fuelEntries.count()) + (await db.serviceRecords.count()) + (await db.trips.count()) > 0, []);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [closed, setClosed] = useState(false);
  const today = todayISO();
  const drive = !!settings?.googleClientId;

  useEffect(() => {
    if (drive) preloadGoogle().catch(() => undefined);
  }, [drive]);

  if (!settings || hasData === undefined || closed || !shouldPrompt(settings, today, hasData)) return null;
  const freq = settings.backupFrequency ?? 'monthly';

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setMessage('');
    try {
      const m = await action();
      if (m) {
        setMessage(m);
        setTimeout(() => setClosed(true), 1800);
      }
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function later() {
    await db.settings.update(1, { backupPromptDate: today });
    setClosed(true);
  }

  return (
    <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-labelledby="backup-prompt-title">
      <div className="sheet">
        <h2 id="backup-prompt-title">Time for your {freq} backup</h2>
        <p className="hint">
          {settings.lastBackupDate ? `Last backup ${new Date(`${settings.lastBackupDate}T00:00:00`).toLocaleDateString()}.` : 'You haven’t backed up yet.'} It keeps your whole history safe if you change or lose
          your phone.
        </p>
        {drive && (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(() => backupToDrive(settings!))}>
            Back up to Google Drive
          </button>
        )}
        <button type="button" className={drive ? 'btn' : 'btn btn-primary'} disabled={busy} onClick={() => run(backupToFiles)}>
          Save to Files / iCloud Drive
        </button>
        <button type="button" className="btn-link" disabled={busy} onClick={later}>
          Later
        </button>
        {message && <p className="hint">{message}</p>}
      </div>
    </div>
  );
}
