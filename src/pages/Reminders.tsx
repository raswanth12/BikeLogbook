import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ReminderRow from '../components/ReminderRow';
import { db } from '../db';
import { useActiveBike, useSettings } from '../db/hooks';
import { buildIcs } from '../lib/export/ics';
import { SOON_DAYS, SOON_KM } from '../lib/reminders/evaluate';
import { loadReminders } from '../db/reminderData';
import { shareOrDownload } from '../lib/share';

export default function Reminders() {
  const navigate = useNavigate();
  const settings = useSettings();
  const bike = useActiveBike();
  const bikeId = settings?.activeBikeId;
  const [status, setStatus] = useState('');

  const data = useLiveQuery(async () => {
    if (!bikeId) return undefined;
    const r = await loadReminders(bikeId);
    const policies = await db.insurancePolicies.where('bikeId').equals(bikeId).toArray();
    return { ...r, dated: r.rules.filter((x) => x.active && x.dueDate), policyEnd: new Map(policies.map((p) => [p.id, p.endDate])) };
  }, [bikeId]);

  if (!settings || !data) return null;
  const dist = settings.distanceUnit;

  async function exportCalendar() {
    const ics = buildIcs(
      data!.dated.map((r) => ({
        id: r.id,
        title: `${r.title}${bike ? ` (${bike.name})` : ''}`,
        dueDate: r.dueDate!,
        repeatMonths: r.repeatMonths,
        alertDays: r.alertDays,
        until: r.policyEvent === 'premium' ? data!.policyEnd.get(r.linkedPolicyId!) : undefined,
        description: 'From Bike Logbook',
      })),
    );
    const file = new File([ics], 'BikeLogbook_Reminders.ics', { type: 'text/calendar' });
    const result = await shareOrDownload(file);
    setStatus(result === 'cancelled' ? '' : 'Open the file and choose Add to add the events to Calendar.');
  }

  return (
    <>
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => navigate('/settings')}>
          Settings
        </button>
        <h1>Reminders</h1>
      </header>
      <p className="hint section-note">
        Reminders show on the Dashboard and as a banner when they're within {SOON_KM} {dist} or {SOON_DAYS} days. They're checked whenever you open the app or save a new odometer
        reading. The app can't notify you while it's closed, so add date reminders to your Calendar for real alerts.
      </p>

      {data.active.length === 0 && data.paused.length === 0 ? (
        <div className="empty">
          <p>No reminders yet.</p>
          <p className="hint">Add one for oil changes, chain lube, insurance or PUC.</p>
        </div>
      ) : (
        <>
          {data.active.length > 0 && (
            <ul className="list">
              {data.active.map((s) => (
                <li key={s.rule.id}>
                  <ReminderRow status={s} distanceUnit={dist} />
                </li>
              ))}
            </ul>
          )}
          {data.paused.length > 0 && (
            <>
              <h2 className="section-title">Paused</h2>
              <ul className="list">
                {data.paused.map((s) => (
                  <li key={s.rule.id}>
                    <ReminderRow status={s} distanceUnit={dist} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      <h2 className="section-title">Calendar</h2>
      <div className="card">
        <p className="hint">
          {data.dated.length
            ? `Exports ${data.dated.length} dated ${data.dated.length === 1 ? 'reminder' : 'reminders'} with alerts ahead of time and on the day.`
            : 'Reminders with a due date can be added to your iPhone Calendar.'}
        </p>
        <button type="button" className="btn" onClick={exportCalendar} disabled={!data.dated.length}>
          Add to Calendar (.ics)
        </button>
        {status && <p className="hint">{status}</p>}
      </div>

      <div className="bottom-actions">
        <Link to="/reminder/new" className="btn btn-primary">
          Add reminder
        </Link>
      </div>
    </>
  );
}
