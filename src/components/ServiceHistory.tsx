import { Link } from 'react-router-dom';
import { useSettings } from '../db/hooks';
import { useServiceData } from '../db/useServiceData';
import { formatDate, formatMoney, formatNumber } from '../lib/format';
import ShowMore, { usePaged } from './ShowMore';

export default function ServiceHistory() {
  const settings = useSettings();
  const data = useServiceData(settings?.activeBikeId);
  const records = [...(data?.records ?? [])].sort((a, b) => b.odometer - a.odometer || b.date.localeCompare(a.date));
  const page = usePaged(records, '');
  if (!settings || !data) return null;

  if (data.records.length === 0) {
    return (
      <div className="empty">
        <p>No services logged yet.</p>
        <p className="hint">Tick what was done at each service, and the app keeps track of when each part was last changed.</p>
      </div>
    );
  }

  const typeName = new Map(data.itemTypes.map((t) => [t.id, t.name]));
  // Item names per service, built once instead of searching all items for every row.
  const namesByRecord = new Map<number, string[]>();
  for (const i of data.items) {
    const list = namesByRecord.get(i.serviceRecordId) ?? [];
    list.push(typeName.get(i.itemTypeId) ?? 'Item');
    namesByRecord.set(i.serviceRecordId, list);
  }

  return (
    <>
      <ul className="list">
        {page.visible.map((r) => {
          const names = namesByRecord.get(r.id) ?? [];
          const summary = names.length > 3 ? `${names.slice(0, 3).join(', ')} +${names.length - 3}` : names.join(', ');
          return (
            <li key={r.id}>
              <Link to={`/service/${r.id}`} className="list-row">
                <div className="row-main">
                  <span className="row-title">
                    {formatDate(r.date)}
                    {r.serviceCenter && <span className="muted"> · {r.serviceCenter}</span>}
                  </span>
                  <span className="row-sub">
                    {formatNumber(r.odometer)} {settings.distanceUnit}
                    {summary && ` · ${summary}`}
                  </span>
                </div>
                <div className="row-side">
                  <span className="row-title">{formatMoney(r.totalCost, settings.currencySymbol, 0)}</span>
                  {r.billPhotoIds.length > 0 && (
                    <span className="row-sub">
                      {r.billPhotoIds.length} {r.billPhotoIds.length === 1 ? 'photo' : 'photos'}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <ShowMore remaining={page.remaining} onMore={page.more} />
    </>
  );
}
