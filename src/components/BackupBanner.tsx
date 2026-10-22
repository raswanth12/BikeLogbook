import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { db } from '../db';
import { useSettings } from '../db/hooks';
import { backupAge } from './BackupSection';
import { backupDue } from '../lib/backup/schedule';
import { todayISO } from '../lib/format';

const KEY = 'backup-banner-dismissed';

function read(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** A gentle nudge when a scheduled backup is due and there is data worth keeping. */
export default function BackupBanner() {
  const settings = useSettings();
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(read);
  const hasData = useLiveQuery(async () => (await db.fuelEntries.count()) + (await db.serviceRecords.count()) + (await db.trips.count()) > 0, []);

  if (!settings || !hasData || dismissed || pathname.startsWith('/settings') || pathname.includes('/new') || /\/\d+$/.test(pathname)) return null;
  if (!backupDue(settings, todayISO())) return null;
  const age = backupAge(settings);

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(KEY, '1');
    } catch {
      // Storage can be blocked in private mode; the banner just returns next time.
    }
  }

  return (
    <div className="banner banner-info" role="status">
      <Link to="/settings" className="banner-text">
        {age == null ? 'No backup yet.' : `Last backup ${age} days ago.`} <strong>Back up now</strong>
      </Link>
      <button type="button" className="banner-close" onClick={dismiss} aria-label="Dismiss backup reminder">
        ×
      </button>
    </div>
  );
}
