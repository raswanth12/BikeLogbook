import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { PlusIcon } from '../components/Icons';
import LogFilters, { useLogFilter } from '../components/LogFilters';
import ShowMore, { usePaged } from '../components/ShowMore';
import { db } from '../db';
import { useSettings } from '../db/hooks';
import { EXPENSE_CATEGORY_LABELS } from '../db/types';
import { formatDate, formatMoney, formatNumber } from '../lib/format';

export default function ExpenseList() {
  const settings = useSettings();
  const bikeId = settings?.activeBikeId;
  const items = useLiveQuery(async () => (bikeId ? await db.expenses.where('bikeId').equals(bikeId).toArray() : undefined), [bikeId]);
  const filter = useLogFilter();
  const visible = [...(items ?? [])]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
    .filter((e) => filter.matches(e.date, `${EXPENSE_CATEGORY_LABELS[e.category]} ${e.notes}`));
  const page = usePaged(visible, `${filter.query}|${filter.from}|${filter.to}`);
  if (!settings || !items) return null;
  const cur = settings.currencySymbol;
  const total = visible.reduce((s, e) => s + e.amount, 0);

  return (
    <>
      {items.length === 0 ? (
        <div className="empty">
          <p>No other expenses yet.</p>
          <p className="hint">Parking, tolls, insurance, PUC, fines and washes go here.</p>
        </div>
      ) : (
        <>
          <div className="stat-row two">
            <div className="stat">
              <span className="stat-label">Entries</span>
              <span className="stat-value">{formatNumber(visible.length)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Spent</span>
              <span className="stat-value">{formatMoney(total, cur, 0)}</span>
            </div>
          </div>
          <LogFilters filter={filter} placeholder="Search category or notes" />
          <ul className="list">
            {page.visible.map((e) => (
              <li key={e.id}>
                <Link to={`/expense/${e.id}`} className="list-row">
                  <div className="row-main">
                    <span className="row-title">{EXPENSE_CATEGORY_LABELS[e.category]}</span>
                    <span className="row-sub">
                      {formatDate(e.date)}
                      {e.notes && ` · ${e.notes}`}
                    </span>
                  </div>
                  <div className="row-side">
                    <span className="row-title">{formatMoney(e.amount, cur, e.amount % 1 ? 2 : 0)}</span>
                  </div>
                </Link>
              </li>
            ))}
            {visible.length === 0 && <li className="empty">No expenses match.</li>}
          </ul>
          <ShowMore remaining={page.remaining} onMore={page.more} />
        </>
      )}
      <Link to="/expense/new" className="fab" aria-label="Add expense">
        <PlusIcon />
      </Link>
    </>
  );
}
