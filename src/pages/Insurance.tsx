import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../db';
import { useActiveBike, useSettings } from '../db/hooks';
import { INSURANCE_COVER_LABELS, type InsurancePolicy } from '../db/types';
import { currentPolicy, policyCost, policyState } from '../lib/calc/insurance';
import { formatDate, formatMoney, todayISO } from '../lib/format';

export function PolicyStatus({ policy, today }: { policy: InsurancePolicy; today: string }) {
  const { state, daysLeft } = policyState(policy, today);
  if (state === 'expired') return <span className="status status-overdue">! Expired {formatDate(policy.endDate)}</span>;
  if (state === 'upcoming') return <span className="status status-ok">Starts {formatDate(policy.startDate)}</span>;
  if (daysLeft <= 30) return <span className="status status-soon">• Renew in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}</span>;
  return <span className="status status-ok">Valid till {formatDate(policy.endDate)}</span>;
}

export default function Insurance() {
  const navigate = useNavigate();
  const settings = useSettings();
  const bike = useActiveBike();
  const bikeId = settings?.activeBikeId;
  const policies = useLiveQuery(async () => (bikeId ? await db.insurancePolicies.where('bikeId').equals(bikeId).toArray() : undefined), [bikeId]);
  if (!settings || !bike || !policies) return null;

  const today = todayISO();
  const cur = settings.currencySymbol;
  const current = currentPolicy(policies, today);
  const history = [...policies].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const cost = current ? policyCost(current) : null;
  const allTime = policies.reduce((s, p) => s + policyCost(p).total, 0);

  return (
    <>
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}>
          Back
        </button>
        <h1>Insurance</h1>
      </header>
      <p className="hint section-note">{bike.name}</p>

      {current && cost ? (
        <Link to={`/insurance/${current.id}`} className="card policy-card">
          <div className="card-head">
            <h2>{current.insurer}</h2>
            <PolicyStatus policy={current} today={today} />
          </div>
          <p className="row-sub">
            {INSURANCE_COVER_LABELS[current.cover]}
            {current.policyNumber && ` · ${current.policyNumber}`}
          </p>
          <div className="stat-grid flush">
            <div className="stat">
              <span className="stat-label">Per year</span>
              <span className="stat-value">{formatMoney(cost.perYear, cur, 0)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Per month</span>
              <span className="stat-value">{formatMoney(cost.perMonth, cur, 0)}</span>
            </div>
            {current.idv != null && (
              <div className="stat">
                <span className="stat-label">IDV</span>
                <span className="stat-value">{formatMoney(current.idv, cur, 0)}</span>
              </div>
            )}
            {current.ncbPercent != null && (
              <div className="stat">
                <span className="stat-label">No-claim bonus</span>
                <span className="stat-value">{current.ncbPercent}%</span>
              </div>
            )}
          </div>
          <p className="row-sub">
            {formatDate(current.startDate)} to {formatDate(current.endDate)}
            {current.addOns.length > 0 && ` · ${current.addOns.join(', ')}`}
          </p>
          {current.contact && <p className="row-sub">{current.contact}</p>}
        </Link>
      ) : (
        <div className="empty">
          <p>No policy yet.</p>
          <p className="hint">Add your policy to track the premium, renewal date and cover in one place.</p>
        </div>
      )}

      {history.length > 0 && (
        <>
          <h2 className="section-title">All policies · {formatMoney(allTime, cur, 0)} in premiums</h2>
          <ul className="list">
            {history.map((p) => (
              <li key={p.id}>
                <Link to={`/insurance/${p.id}`} className="list-row">
                  <div className="row-main">
                    <span className="row-title">{p.insurer}</span>
                    <span className="row-sub">
                      {formatDate(p.startDate)} to {formatDate(p.endDate)}
                    </span>
                  </div>
                  <div className="row-side">
                    <span className="row-title">{formatMoney(policyCost(p).total, cur, 0)}</span>
                    <span className="row-sub">{INSURANCE_COVER_LABELS[p.cover].split(' (')[0]}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="bottom-actions">
        <Link to="/insurance/new" className="btn btn-primary">
          {current ? 'Add or renew a policy' : 'Add policy'}
        </Link>
      </div>
    </>
  );
}
