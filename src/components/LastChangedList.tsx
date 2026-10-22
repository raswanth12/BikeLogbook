import { Link } from 'react-router-dom';
import { useActiveBike, useSettings } from '../db/hooks';
import { itemFitsVehicle } from '../db/seed';
import { useServiceData } from '../db/useServiceData';
import { SERVICE_CATEGORY_LABELS } from '../db/types';
import { latestOdometer } from '../lib/calc/odometer';
import { lastChanged } from '../lib/calc/service';
import { groupByCategory, intervalText } from '../lib/catalog';
import { formatDate, formatNumber, todayISO } from '../lib/format';

function daysText(days: number): string {
  if (days === 0) return 'today';
  if (days < 60) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  if (days < 730) return `${Math.round(days / 30.4)} months ago`;
  return `${(days / 365.25).toFixed(1)} years ago`;
}

export default function LastChangedList() {
  const settings = useSettings();
  const bike = useActiveBike();
  const data = useServiceData(settings?.activeBikeId);
  if (!settings || !data) return null;

  const dist = settings.distanceUnit;
  const changed = lastChanged(data.records, data.items, latestOdometer(data.readings), todayISO());
  const visible = data.itemTypes.filter((t) => (!t.hidden && itemFitsVehicle(t, bike?.kind)) || changed.has(t.id));

  return (
    <>
      {groupByCategory(visible).map((group) => (
        <section key={group.category} className="checklist-group">
          <h3>{SERVICE_CATEGORY_LABELS[group.category]}</h3>
          <ul className="list">
            {group.items.map((t) => {
              const lc = changed.get(t.id);
              const interval = intervalText(t, dist);
              const body = (
                <>
                  <div className="row-main">
                    <span className="row-title">{t.name}</span>
                    <span className="row-sub">{lc ? `${formatDate(lc.date)} at ${formatNumber(lc.odometer)} ${dist}` : interval || 'No interval set'}</span>
                  </div>
                  <div className="row-side">
                    {lc ? (
                      <>
                        <span className="row-title">{lc.kmSince != null ? `${formatNumber(lc.kmSince)} ${dist}` : '—'}</span>
                        <span className="row-sub">{daysText(lc.daysSince)}</span>
                      </>
                    ) : (
                      <span className="row-sub">Never</span>
                    )}
                  </div>
                </>
              );
              return (
                <li key={t.id}>
                  {lc ? (
                    <Link to={`/service/${lc.serviceRecordId}`} className="list-row">
                      {body}
                    </Link>
                  ) : (
                    <div className="list-row">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </>
  );
}
