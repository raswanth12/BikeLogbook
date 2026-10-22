import { Link } from 'react-router-dom';
import type { ReminderRule } from '../db/types';
import { formatDate, formatNumber } from '../lib/format';
import { describeStatus, type ReminderStatus } from '../lib/reminders/evaluate';

const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

const STATE_LABEL = { overdue: 'Overdue', soon: 'Due soon', ok: '', unscheduled: '' };

/** One reminder: title, plain-language status, and a labelled badge for overdue or due soon. */
export default function ReminderRow({ status, distanceUnit }: { status: ReminderStatus<ReminderRule>; distanceUnit: string }) {
  const { rule, state } = status;
  const targets = [rule.dueOdometer != null ? `${formatNumber(rule.dueOdometer)} ${distanceUnit}` : null, rule.dueDate ? formatDate(rule.dueDate) : null]
    .filter(Boolean)
    .join(' or ');
  const w = status.window;
  const windowText = w
    ? [w.fromKm != null ? `${formatNumber(w.fromKm)}–${formatNumber(w.toKm!)} ${distanceUnit}` : null, w.fromDate ? `${shortDate(w.fromDate)} – ${shortDate(w.toDate!)}` : null]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <Link to={`/reminder/${rule.id}`} className="list-row">
      <div className="row-main">
        <span className="row-title">{rule.title}</span>
        <span className="row-sub">{targets ? `At ${targets}` : 'No due point set'}</span>
        {windowText && <span className="row-sub">Window {windowText}</span>}
        {status.projectedDate && rule.active && <span className="row-sub">At your pace, about {formatDate(status.projectedDate)}</span>}
      </div>
      <div className="row-side">
        {STATE_LABEL[state] && (
          <span className={`status status-${state}`}>
            <span aria-hidden="true">{state === 'overdue' ? '!' : '•'}</span> {STATE_LABEL[state]}
          </span>
        )}
        <span className="row-sub">{rule.active ? describeStatus(status, distanceUnit) : 'Paused'}</span>
      </div>
    </Link>
  );
}
