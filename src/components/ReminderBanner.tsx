import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSettings } from '../db/hooks';
import { useReminders } from '../db/useReminders';
import { describeStatus } from '../lib/reminders/evaluate';

const KEY = 'reminder-banner-dismissed';

function readDismissed(): string {
  try {
    return sessionStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * A banner at the top of every screen when something is overdue or due soon. The Dashboard
 * already lists reminders, so it's hidden there. Dismissing hides it until something changes.
 */
export default function ReminderBanner() {
  const settings = useSettings();
  const reminders = useReminders(settings?.activeBikeId);
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(readDismissed);

  if (!settings || !reminders) return null;
  const due = reminders.filter((s) => s.state === 'overdue' || s.state === 'soon');
  const signature = due.map((s) => `${s.rule.id}:${s.state}`).join(',');
  if (!due.length || dismissed === signature || pathname === '/' || pathname.includes('reminder')) return null;

  const first = due[0];
  const overdue = due.some((s) => s.state === 'overdue');

  function dismiss() {
    setDismissed(signature);
    try {
      sessionStorage.setItem(KEY, signature);
    } catch {
      // Private mode can block storage; the banner simply comes back next time.
    }
  }

  return (
    <div className={overdue ? 'banner banner-overdue' : 'banner'} role="status">
      <Link to="/" className="banner-text">
        <strong>{first.rule.title}</strong> · {describeStatus(first, settings.distanceUnit)}
        {due.length > 1 && <span> · +{due.length - 1} more</span>}
      </Link>
      <button type="button" className="banner-close" onClick={dismiss} aria-label="Dismiss reminder banner">
        ×
      </button>
    </div>
  );
}
