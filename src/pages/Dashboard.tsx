import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import InstallGuide from '../components/InstallGuide';
import MileageTrend from '../components/MileageTrend';
import QuickAdd from '../components/QuickAdd';
import ReminderRow from '../components/ReminderRow';
import Ring from '../components/Ring';
import { mileageGauge, serviceGauge, spendGauge } from '../lib/calc/gauges';
import type { ReminderStatus } from '../lib/reminders/evaluate';
import { addMonths } from '../lib/reminders/evaluate';
import { useBikeData } from '../db/useBikeData';
import { currentPolicy, policyCost } from '../lib/calc/insurance';
import { ownership } from '../lib/calc/ownership';
import { PolicyStatus } from './Insurance';
import VehicleSwitcher from '../components/VehicleSwitcher';
import { unitsFor } from '../lib/units';
import SpendSplitBar from '../components/SpendSplitBar';
import { db } from '../db';
import { useActiveBike, useSettings } from '../db/hooks';
import { useReminders } from '../db/useReminders';
import { monthBounds, spendBetween } from '../lib/calc/aggregates';
import { mileageSeries, summarizeMileage } from '../lib/calc/mileage';
import { latestOdometer } from '../lib/calc/odometer';
import { formatMoney, formatNumber, todayISO } from '../lib/format';
import { isStandalone } from '../lib/storage';

const TREND_POINTS = 20;

export default function Dashboard() {
  const settings = useSettings();
  const bike = useActiveBike();
  const bikeId = settings?.activeBikeId;
  const reminders = useReminders(bikeId);

  const data = useBikeData(bikeId);

  const view = useMemo(() => {
    if (!data) return undefined;
    const today = todayISO();
    const { start, end } = monthBounds(today);
    const series = mileageSeries(data.fuel);
    const dateById = new Map(data.fuel.map((f) => [f.id, f.date]));
    return {
      odometer: latestOdometer(data.readings),
      mileage: summarizeMileage(series),
      trend: series.slice(-TREND_POINTS).map((r) => ({ date: dateById.get(r.id)!, kmPerLitre: r.kmPerLitre })),
      month: spendBetween(data, start, end),
      monthName: new Date(`${today}T00:00:00`).toLocaleDateString(undefined, { month: 'long' }),
      owned: data.bike ? ownership(data.bike, data, data.readings, today) : null,
      policy: currentPolicy(data.policies, today),
      // The six months before this one, for the "usual month" on the spend ring.
      previousMonths: [1, 2, 3, 4, 5, 6].map((back) => {
        const b = monthBounds(addMonths(start, -back));
        return spendBetween(data, b.start, b.end).total;
      }),
      today,
    };
  }, [data]);

  if (!settings || !view) return null;
  const showGuide = !settings.installGuideDismissed && !isStandalone();
  const cur = settings.currencySymbol;
  const units = unitsFor(settings, bike);
  const unit = units.mileage;
  const service = serviceGauge(reminders ?? []);
  const mileage = mileageGauge(view.mileage.last5KmPerLitre, view.mileage.overallKmPerLitre);
  const spend = spendGauge(view.month.total, view.previousMonths);
  const range = bike?.tankCapacity && view.mileage.last5KmPerLitre ? bike.tankCapacity * view.mileage.last5KmPerLitre : null;

  return (
    <>
      <header className="page-header">
        <VehicleSwitcher />
        {bike?.registration && <span className="muted">{bike.registration}</span>}
      </header>

      {showGuide && <InstallGuide onDismiss={() => db.settings.update(1, { installGuideDismissed: true })} />}

      <section className="hero-panel">
        <div className="hero-odo">
          <span className="eyebrow">Odometer</span>
          {view.odometer != null ? (
            <p className="hero-number">
              {formatNumber(view.odometer)}
              <span>{units.distance}</span>
            </p>
          ) : (
            <p className="hint">No readings yet. Tap + to log your first fill-up.</p>
          )}
          <div className="hero-chips">
            {range != null && (
              <span className="pill">
                Range ~{formatNumber(range)} {units.distance}
              </span>
            )}
            {view.mileage.overallCostPerKm != null && (
              <span className="pill">
                Fuel {formatMoney(view.mileage.overallCostPerKm, cur)}/{units.distance}
              </span>
            )}
          </div>
        </div>
        <div className="rings">
          <Ring
            fill={service?.fill ?? 0}
            tone={service?.tone ?? 'empty'}
            label="Next service"
            value={service ? serviceValue(service.status) : '—'}
            unit={service ? serviceUnit(service.status, units.distance) : undefined}
            sub={service ? service.status.rule.title : 'Add a reminder'}
          />
          <Ring
            fill={mileage.fill}
            tone={mileage.tone}
            label="Mileage"
            value={view.mileage.last5KmPerLitre != null ? formatNumber(view.mileage.last5KmPerLitre, 1) : '—'}
            unit={unit}
            sub={view.mileage.overallKmPerLitre != null ? `Avg ${formatNumber(view.mileage.overallKmPerLitre, 1)}` : 'Two full tanks needed'}
          />
          <Ring
            fill={spend.fill}
            tone={spend.tone}
            label={view.monthName}
            value={compactMoney(view.month.total, cur)}
            sub={spend.usual != null ? `Usual ${compactMoney(spend.usual, cur)}` : 'Spent so far'}
          />
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Reminders</h2>
          <Link to="/settings/reminders" className="card-link">
            {reminders?.length ? 'All' : 'Add'}
          </Link>
        </div>
        {reminders?.length ? (
          <ul className="list flush">
            {/* Everything due, plus the next couple coming up */}
            {reminders
              .filter((s, i) => s.state === 'overdue' || s.state === 'soon' || i < 3)
              .slice(0, 6)
              .map((s) => (
                <li key={s.rule.id}>
                  <ReminderRow status={s} distanceUnit={settings.distanceUnit} />
                </li>
              ))}
          </ul>
        ) : (
          <p className="hint">Set reminders for oil changes, insurance and PUC, and they'll show here when they're due.</p>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>{view.monthName} spend</h2>
          <span className="card-total">{formatMoney(view.month.total, cur, 0)}</span>
        </div>
        {view.month.total > 0 ? <SpendSplitBar split={view.month} currency={cur} /> : <p className="hint">Nothing spent this month yet.</p>}
      </section>

      {view.owned && bike && (
        <section className="card">
          <div className="card-head">
            <h2>Ownership</h2>
            <Link to={`/vehicle/${bike.id}`} className="card-link">
              Edit
            </Link>
          </div>
          <Link to="/insurance" className="owner-insurance">
            <span className="stat-label">Insurance</span>
            {view.policy ? (
              <span className="owner-line">
                <span>
                  {view.policy.insurer} · {formatMoney(policyCost(view.policy).perYear, cur, 0)}/yr
                </span>
                <PolicyStatus policy={view.policy} today={view.today} />
              </span>
            ) : (
              <span className="accent">Add your policy</span>
            )}
          </Link>
          <div className="stat-grid flush">
            <div className="stat">
              <span className="stat-label">Bought for</span>
              <span className="stat-value">{view.owned.purchasePrice != null ? formatMoney(view.owned.purchasePrice, cur, 0) : '—'}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Spent since</span>
              <span className="stat-value">{formatMoney(view.owned.running.total, cur, 0)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Running cost / {units.distance}</span>
              <span className="stat-value">{view.owned.runningPerKm != null ? formatMoney(view.owned.runningPerKm, cur) : '—'}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Per month</span>
              <span className="stat-value">{view.owned.runningPerMonth != null ? formatMoney(view.owned.runningPerMonth, cur, 0) : '—'}</span>
            </div>
            {view.owned.purchasePrice != null && (
              <div className="stat wide">
                <span className="stat-label">Total cost of ownership · {formatNumber(view.owned.km)} {units.distance}</span>
                <span className="stat-value">
                  {formatMoney(view.owned.totalCost, cur, 0)}
                  {view.owned.totalPerKm != null && <span className="muted"> · {formatMoney(view.owned.totalPerKm, cur)}/{units.distance}</span>}
                </span>
              </div>
            )}
          </div>
          {view.owned.purchasePrice == null && (
            <Link to={`/vehicle/${bike.id}`} className="hint accent">
              Add the purchase price to see the total cost of ownership.
            </Link>
          )}
        </section>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Mileage trend</h2>
        </div>
        {view.trend.length >= 2 ? (
          <MileageTrend points={view.trend} average={view.mileage.overallKmPerLitre} unit={unit} />
        ) : (
          <p className="hint">The trend appears once you have logged three full-tank fills.</p>
        )}
      </section>

      <QuickAdd />
    </>
  );
}

const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
function compactMoney(v: number, symbol: string): string {
  return `${symbol}${compact.format(v)}`;
}

/** The number in the service ring: km left if it's a km reminder, else days left. */
function serviceValue(s: ReminderStatus): string {
  if (s.kmLeft != null && s.rule.repeatKm) return compact.format(Math.abs(s.kmLeft));
  return s.daysLeft != null ? String(Math.abs(s.daysLeft)) : '—';
}

function serviceUnit(s: ReminderStatus, dist: string): string {
  const late = s.state === 'overdue';
  if (s.kmLeft != null && s.rule.repeatKm) return late ? `${dist} over` : `${dist} left`;
  return late ? 'days late' : 'days left';
}
