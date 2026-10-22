import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { PlusIcon } from '../components/Icons';
import LogFilters, { useLogFilter } from '../components/LogFilters';
import ShowMore, { usePaged } from '../components/ShowMore';
import { db } from '../db';
import { useSettings } from '../db/hooks';
import { ACCESSORY_CATEGORY_LABELS } from '../db/types';
import { formatDate, formatMoney, formatNumber } from '../lib/format';

export default function AccessoryList() {
  const settings = useSettings();
  const bikeId = settings?.activeBikeId;
  const items = useLiveQuery(async () => (bikeId ? await db.accessories.where('bikeId').equals(bikeId).toArray() : undefined), [bikeId]);
  const filter = useLogFilter();
  const visible = [...(items ?? [])]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    .filter((a) => filter.matches(a.date, `${a.name} ${ACCESSORY_CATEGORY_LABELS[a.category]} ${a.shop} ${a.notes}`));
  const page = usePaged(visible, `${filter.query}|${filter.from}|${filter.to}`);
  if (!settings || !items) return null;
  const cur = settings.currencySymbol;
  const total = visible.reduce((s, a) => s + a.price, 0);

  return (
    <>
      {items.length === 0 ? (
        <div className="empty">
          <p>No accessories yet.</p>
          <p className="hint">Crash guards, luggage, phone mounts: log what you add to the bike and what it cost.</p>
        </div>
      ) : (
        <>
          <div className="stat-row two">
            <div className="stat">
              <span className="stat-label">Items</span>
              <span className="stat-value">{formatNumber(visible.length)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Spent</span>
              <span className="stat-value">{formatMoney(total, cur, 0)}</span>
            </div>
          </div>
          <LogFilters filter={filter} placeholder="Search name, shop or notes" />
          <ul className="list">
            {page.visible.map((a) => (
              <li key={a.id}>
                <Link to={`/accessory/${a.id}`} className="list-row">
                  <div className="row-main">
                    <span className="row-title">{a.name}</span>
                    <span className="row-sub">
                      {formatDate(a.date)} · {ACCESSORY_CATEGORY_LABELS[a.category]}
                      {a.shop && ` · ${a.shop}`}
                      {a.photoId != null && <span className="badge">Photo</span>}
                    </span>
                  </div>
                  <div className="row-side">
                    <span className="row-title">{formatMoney(a.price, cur, 0)}</span>
                  </div>
                </Link>
              </li>
            ))}
            {visible.length === 0 && <li className="empty">No accessories match.</li>}
          </ul>
          <ShowMore remaining={page.remaining} onMore={page.more} />
        </>
      )}
      <Link to="/accessory/new" className="fab" aria-label="Add accessory">
        <PlusIcon />
      </Link>
    </>
  );
}
