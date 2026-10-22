import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { PlusIcon } from '../components/Icons';
import LogFilters, { useLogFilter } from '../components/LogFilters';
import ShowMore, { usePaged } from '../components/ShowMore';
import { db } from '../db';
import { useSettings } from '../db/hooks';
import { tripDistance, tripTotals } from '../lib/calc/trips';
import { formatDate, formatNumber } from '../lib/format';

export default function TripList() {
  const settings = useSettings();
  const bikeId = settings?.activeBikeId;
  const trips = useLiveQuery(async () => (bikeId ? await db.trips.where('bikeId').equals(bikeId).toArray() : undefined), [bikeId]);
  const filter = useLogFilter();
  const visible = [...(trips ?? [])]
    .sort((a, b) => b.date.localeCompare(a.date) || b.endOdometer - a.endOdometer)
    .filter((t) => filter.matches(t.date, `${t.purpose} ${t.tags.join(' ')} ${t.notes}`));
  const page = usePaged(visible, `${filter.query}|${filter.from}|${filter.to}`);
  if (!settings || !trips) return null;
  const dist = settings.distanceUnit;
  const totals = tripTotals(visible);

  return (
    <>
      {trips.length === 0 ? (
        <div className="empty">
          <p>No trips yet.</p>
          <p className="hint">Log rides with start and end readings to see how far you go.</p>
        </div>
      ) : (
        <>
          <div className="stat-row two">
            <div className="stat">
              <span className="stat-label">Trips</span>
              <span className="stat-value">{formatNumber(totals.count)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Distance</span>
              <span className="stat-value">
                {formatNumber(totals.distance)} {dist}
              </span>
            </div>
          </div>
          <LogFilters filter={filter} placeholder="Search route, tags or notes" />
          <ul className="list">
            {page.visible.map((t) => (
              <li key={t.id}>
                <Link to={`/trip/${t.id}`} className="list-row">
                  <div className="row-main">
                    <span className="row-title">
                      {formatDate(t.date)}
                      {t.purpose && <span className="muted"> · {t.purpose}</span>}
                    </span>
                    <span className="row-sub">
                      {formatNumber(t.startOdometer)} → {formatNumber(t.endOdometer)}
                      {t.tags.map((tag) => (
                        <span key={tag} className="badge">
                          {tag}
                        </span>
                      ))}
                    </span>
                  </div>
                  <div className="row-side">
                    <span className="row-title">
                      {formatNumber(tripDistance(t))} {dist}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
            {visible.length === 0 && <li className="empty">No trips match.</li>}
          </ul>
          <ShowMore remaining={page.remaining} onMore={page.more} />
        </>
      )}
      <Link to="/trip/new" className="fab" aria-label="Add trip">
        <PlusIcon />
      </Link>
    </>
  );
}
