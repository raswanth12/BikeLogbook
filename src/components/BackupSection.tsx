import { useEffect, useState, type ChangeEvent } from 'react';
import { db } from '../db';
import type { BackupFrequency, Settings } from '../db/types';
import { backupToDrive, backupToFiles } from '../lib/backup/actions';
import { downloadBackup, ensureFolder, FOLDER_NAME, getToken, listBackups, preloadGoogle, type DriveFile } from '../lib/backup/googleDrive';
import { backupDue } from '../lib/backup/schedule';
import { daysBetween } from '../lib/calc/service';
import { parseBackup, restoreMerge, restoreReplace, summarizeBackup, type BackupFile } from '../lib/export/backup';
import { formatDate, todayISO } from '../lib/format';
import ChipPicker from './ChipPicker';
import ExportPanel from './ExportPanel';

export function backupAge(settings: Settings, today = todayISO()): number | null {
  return settings.lastBackupDate ? daysBetween(settings.lastBackupDate, today) : null;
}

const FREQUENCIES: { value: BackupFrequency; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'off', label: 'Off' },
];

export default function BackupSection({ settings }: { settings: Settings }) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ backup: BackupFile; fileName: string } | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFile[] | null>(null);
  const [clientId, setClientId] = useState(settings.googleClientId ?? '');
  const age = backupAge(settings);
  const stale = backupDue(settings, todayISO());
  const drive = !!settings.googleClientId;

  useEffect(() => {
    if (drive) preloadGoogle().catch(() => undefined);
  }, [drive]);

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setStatus('');
    try {
      const m = await action();
      if (m) setStatus(m);
    } catch (err) {
      setStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setStatus('');
    try {
      setPending({ backup: parseBackup(await file.text()), fileName: file.name });
    } catch (err) {
      setPending(null);
      setStatus((err as Error).message);
    }
  }

  // Listing needs a token, so it also starts from a tap.
  function showDriveBackups() {
    run(async () => {
      const token = await getToken(settings.googleClientId!);
      const folderId = await ensureFolder(token, settings.driveFolderId);
      if (folderId !== settings.driveFolderId) await db.settings.update(1, { driveFolderId: folderId });
      const files = await listBackups(token, folderId);
      setDriveFiles(files);
      return files.length ? '' : `No backups in "${FOLDER_NAME}" on Google Drive yet.`;
    });
  }

  function pickDriveBackup(f: DriveFile) {
    run(async () => {
      const token = await getToken(settings.googleClientId!);
      setPending({ backup: parseBackup(await downloadBackup(token, f.id)), fileName: f.name });
      setDriveFiles(null);
      return '';
    });
  }

  async function restore(mode: 'merge' | 'replace') {
    if (!pending) return;
    const question =
      mode === 'replace'
        ? 'Replace everything on this phone with the backup? Anything logged since the backup will be lost.'
        : 'Add the records from the backup to what is already here? Records that are already here are skipped.';
    if (!window.confirm(question)) return;
    await run(async () => {
      try {
        if (mode === 'replace') {
          await restoreReplace(db, pending.backup);
          setPending(null);
          return 'Restored. Everything now matches the backup.';
        }
        const r = await restoreMerge(db, pending.backup);
        setPending(null);
        return `Merged. Added ${r.added} records, skipped ${r.skipped} already here.`;
      } catch (err) {
        throw new Error(`Restore failed, nothing was changed: ${(err as Error).message}`);
      }
    });
  }

  async function saveClientId() {
    const id = clientId.trim();
    await db.settings.update(1, { googleClientId: id || undefined, driveFolderId: id ? settings.driveFolderId : undefined });
    setStatus(id ? 'Saved. Tap "Back up to Google Drive" to sign in the first time.' : 'Google Drive turned off.');
  }

  const s = pending ? summarizeBackup(pending.backup) : null;

  return (
    <>
      <h2 className="section-title" id="backup">
        Backup
      </h2>
      <div className={stale ? 'card backup-card stale' : 'card backup-card'}>
        <p>
          {age == null ? 'No backup yet.' : `Last backup ${formatDate(settings.lastBackupDate!)}${age > 0 ? `, ${age} ${age === 1 ? 'day' : 'days'} ago` : ', today'}.`}
          {settings.lastDriveBackup && <span className="muted"> Google Drive: {formatDate(settings.lastDriveBackup.slice(0, 10))}.</span>}
        </p>
        <p className="hint">Your logbook lives only on this phone. Back up regularly so you keep the whole history if you change or lose the phone.</p>
        <div className="field">
          <span>Remind me to back up</span>
          <ChipPicker label="Backup schedule" options={FREQUENCIES} selected={[settings.backupFrequency ?? 'monthly']} onToggle={(v) => db.settings.update(1, { backupFrequency: v })} />
          <span className="hint">When it's due, the app asks when you open it. iPhone doesn't let web apps run in the background, so it takes one tap.</span>
        </div>
        {drive && (
          <button type="button" className="btn btn-primary" onClick={() => run(() => backupToDrive(settings))} disabled={busy}>
            Back up to Google Drive
          </button>
        )}
        <button type="button" className={drive ? 'btn' : 'btn btn-primary'} onClick={() => run(backupToFiles)} disabled={busy}>
          Save to Files / iCloud Drive
        </button>
        <label className="btn file-btn">
          Restore from a file
          <input type="file" accept="application/json,.json" onChange={onPick} disabled={busy} />
        </label>
        {drive && (
          <button type="button" className="btn" onClick={showDriveBackups} disabled={busy}>
            Restore from Google Drive
          </button>
        )}

        {driveFiles && driveFiles.length > 0 && (
          <ul className="list flush drive-list">
            {driveFiles.map((f) => (
              <li key={f.id}>
                <button type="button" className="list-row row-button" onClick={() => pickDriveBackup(f)}>
                  <span className="row-main">
                    <span className="row-title">{f.name}</span>
                    <span className="row-sub">
                      {new Date(f.createdTime).toLocaleString()}
                      {f.size && ` · ${Math.round(Number(f.size) / 1024)} KB`}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {pending && s && (
          <div className="restore-preview">
            <p>
              <strong>{pending.fileName}</strong>
              {s.exportedAt && <span className="muted"> · made {formatDate(s.exportedAt.slice(0, 10))}</span>}
            </p>
            <p className="hint">
              {s.fuel} fill-ups, {s.services} services, {s.trips} trips, {s.accessories} accessories, {s.expenses} expenses, {s.policies} insurance policies, {s.reminders} reminders,{' '}
              {s.photos} photos.
            </p>
            <div className="field-row">
              <button type="button" className="btn" onClick={() => restore('merge')} disabled={busy}>
                Merge
              </button>
              <button type="button" className="btn btn-danger" onClick={() => restore('replace')} disabled={busy}>
                Replace
              </button>
            </div>
            <button type="button" className="btn-link align-start" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        )}
        {status && <p className="hint">{status}</p>}

        <details className="table-view">
          <summary>{drive ? 'Google Drive settings' : 'Set up automatic Google Drive backup'}</summary>
          <div className="form drive-setup">
            <p className="hint">
              Backups go to a "{FOLDER_NAME}" folder in your Drive. The app can only see files it made, never the rest of your Drive. You need a free Google Cloud OAuth client ID: the README has
              the steps (about 5 minutes).
            </p>
            <label className="field">
              <span>OAuth client ID</span>
              <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="1234…apps.googleusercontent.com" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
            </label>
            <button type="button" className="btn" onClick={saveClientId}>
              {clientId.trim() ? 'Save' : 'Turn off Google Drive'}
            </button>
          </div>
        </details>
      </div>

      <h2 className="section-title">Export</h2>
      <div className="card">
        <p className="hint">Everything you've logged for this vehicle, as an Excel workbook.</p>
        <ExportPanel options={[{ label: 'Export everything to Excel', scope: { kind: 'all' } }]} />
      </div>
    </>
  );
}
