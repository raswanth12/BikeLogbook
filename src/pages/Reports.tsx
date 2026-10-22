import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ExportPanel from '../components/ExportPanel';
import FleetTotals from '../components/FleetTotals';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { RIDING_CONDITIONS } from '../db/types';
import { mileageByCondition } from '../lib/calc/mileage';
import { ChevronIcon } from '../components/Icons';
import MileageTrend from '../components/MileageTrend';
import MonthlySpendChart from '../components/MonthlySpendChart';
import SpendSplitBar from '../components/SpendSplitBar';
import { useActiveBike, useSettings } from '../db/hooks';
import { unitsFor } from '../lib/units';
import { useBikeData, type BikeData } from '../db/useBikeData';
import type { Settings } from '../db/types';
import { buildReport, monthlySpend, periodRange, shiftPeriod, type DatedMileage, type PeriodKind, type PeriodReport } from '../lib/calc/periods';
import { formatDate, formatMoney, formatNumber, todayISO } from '../lib/format';

const KINDS: { kind: PeriodKind; label: string }[] = [
  { kind: 'week', label: 'Weekly' },
  { kind: 'month', label: 'Monthly' },
  { kind: 'year', label: 'Yearly' },
];

const asDate = (iso: string) => new Date(`${iso}T00:00:00`);

function periodContains(kind: PeriodKind, anchor: string, day: string): boolean {
  const { start, end } = periodRange(kind, anchor);
  return day >= start && day <= end;
}

function periodLabel(kind: PeriodKind, start: string, end: string): string {
  if (kind === 'year') return start.slice(0, 4);
  if (kind === 'month') return asDate(start).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const s = asDate(start);
  const e = asDate(end);
  const sameMonth = s.getMonth() === e.getMonth();
  const left = s.toLocaleDateString(undefined, sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' });
  return `${left} – ${e.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export default function Reports() {
  const settings = useSettings();
  const active = useActiveBike();
  const vehicles = useLiveQuery(() => db.bikes.toArray(), []);
  // Reports can look at any vehicle without changing the one you're logging for.
  const [vehicleId, setVehicleId] = useState<number | null>(null);
  const shownId = vehicleId ?? settings?.activeBikeId;
  const bike = vehicles?.find((v) => v.id === shownId) ?? active;
  const data = useBikeData(shownId);
  const [params, setParams] = useSearchParams();
  const today = todayISO();
  // Held in state so quick repeated taps each move one more period; mirrored to the URL so
  // going into a service and back returns to the same period.
  const [kind, setKind] = useState<PeriodKind>(() => KINDS.find((k) => k.kind === params.get('period'))?.kind ?? 'month');
  const [anchor, setAnchor] = useState(() => params.get('at') ?? today);
  const { start, end } = periodRange(kind, anchor);
  const isCurrent = periodContains(kind, anchor, today);

  useEffect(() => {
    const next = new URLSearchParams({ period: kind });
    if (!periodContains(kind, anchor, today)) next.set('at', anchor);
    setParams(next, { replace: true });
  }, [kind, anchor, today, setParams]);

  const report = useMemo(() => (data ? buildReport(data, start, end) : undefined), [data, start, end]);

  const step = (delta: number) =>
    setAnchor((a) => {
      const moved = shiftPeriod(kind, a, delta);
      return periodRange(kind, moved).start > today ? a : moved; // never past the current period
    });

  return (
    <>
      <header className="page-header">
        <h1>Reports</h1>
      </header>
      <div className="segmented" role="tablist">
        {KINDS.map((k) => (
          <button key={k.kind} type="button" role="tab" aria-selected={kind === k.kind} className={kind === k.kind ? 'seg active' : 'seg'} onClick={() => setKind(k.kind)}>
            {k.label}
          </button>
        ))}
      </div>

      {vehicles && vehicles.length > 1 && (
        <div className="segmented" role="tablist" aria-label="Vehicle">
          {vehicles.map((v) => (
            <button key={v.id} type="button" role="tab" aria-selected={v.id === shownId} className={v.id === shownId ? 'seg active' : 'seg'} onClick={() => setVehicleId(v.id)}>
              {v.name}
            </button>
          ))}
        </div>
      )}

      <div className="period-nav">
        <button type="button" className="icon-btn prev" onClick={() => step(-1)} aria-label="Previous period">
          <ChevronIcon />
        </button>
        <span className="period-label" aria-live="polite">
          {periodLabel(kind, start, end)}
        </span>
        <button type="button" className="icon-btn next" onClick={() => step(1)} disabled={isCurrent} aria-label="Next period">
          <ChevronIcon />
        </button>
      </div>

      {settings && data && report && <ReportBody kind={kind} start={start} end={end} report={report} data={data} settings={settings} fuelUnit={unitsFor(settings, bike).fuel} mileageUnit={unitsFor(settings, bike).mileage} />}

      {settings && <FleetTotals start={start} end={end} settings={settings} />}

      <h2 className="section-title">Export {bike ? bike.name : ''} to Excel</h2>
      <div className="card">
        <ExportPanel
          bikeId={shownId}
          options={[
            { label: periodLabel('month', periodRange('month', anchor).start, ''), scope: { kind: 'month', anchor } },
            { label: anchor.slice(0, 4), scope: { kind: 'year', anchor } },
            { label: 'All data', scope: { kind: 'all' } },
          ]}
        />
      </div>
    </>
  );
}

function ReportBody({ kind, start, end, report, data, settings, fuelUnit, mileageUnit }: { kind: PeriodKind; start: string; end: string; report: PeriodReport; data: BikeData; settings: Settings; fuelUnit: string; mileageUnit: string }) {
  const cur = settings.currencySymbol;
  const dist = settings.distanceUnit;
  const money = (v: number) => formatMoney(v, cur, 0);
  const kmpl = (v: number | null) => (v != null ? `${formatNumber(v, 1)} ${mileageUnit}` : '—');
  const perKm = (v: number | null) => (v != null ? formatMoney(v, cur) : '—');

  const services = data.services.filter((s) => s.date >= start && s.date <= end).sort((a, b) => a.date.localeCompare(b.date) || a.odometer - b.odometer);
  const empty = report.km === 0 && report.spend.total === 0 && report.fillCount === 0 && report.tripCount === 0;

  const stats: [string, ReactNode][] = [
    [kind === 'year' ? 'Total km' : 'Km ridden', `${formatNumber(report.km)} ${dist}`],
    ['Average mileage', kmpl(report.kmPerLitre)],
    ['Fuel', `${formatNumber(report.litres, 1)} ${fuelUnit}`],
    ['Fuel spend', money(report.fuelSpend)],
    ['Trips', report.tripCount ? `${report.tripCount} · ${formatNumber(report.tripKm)} ${dist}` : '0'],
  ];
  if (kind !== 'week') {
    stats.push(
      ['Service', money(report.spend.service)],
      ['Accessories', money(report.spend.accessories)],
      ['Other', money(report.spend.other)],
      ['Total cost', money(report.spend.total)],
      [`Cost per ${dist}`, perKm(report.costPerKm)],
    );
  }

  return (
    <>
      {empty && <p className="hint section-note">Nothing logged in this period.</p>}

      <div className="stat-grid">
        {stats.map(([label, value]) => (
          <div key={label} className="stat">
            <span className="stat-label">{label}</span>
            <span className="stat-value">{value}</span>
          </div>
        ))}
      </div>

      {kind === 'month' && report.best && (
        <section className="card">
          <div className="card-head">
            <h2>Fill-ups</h2>
          </div>
          <FillLine label="Best" m={report.best} kmpl={kmpl} dist={dist} />
          {report.worst && <FillLine label="Worst" m={report.worst} kmpl={kmpl} dist={dist} />}
        </section>
      )}

      {kind !== 'week' && <ConditionCard fills={data.fuel.filter((f) => f.date >= start && f.date <= end)} all={data.fuel} kmpl={kmpl} />}

      {kind === 'year' && (
        <>
          <section className="card">
            <div className="card-head">
              <h2>Cost of ownership</h2>
              <span className="card-total">{money(report.spend.total)}</span>
            </div>
            {report.spend.total > 0 ? <SpendSplitBar split={report.spend} currency={cur} /> : <p className="hint">No spending this year.</p>}
          </section>
          <section className="card">
            <div className="card-head">
              <h2>Spend by month</h2>
            </div>
            <MonthlySpendChart months={monthlySpend(data, Number(start.slice(0, 4)))} currency={cur} />
          </section>
          <section className="card">
            <div className="card-head">
              <h2>Mileage trend</h2>
            </div>
            {report.mileage.length >= 2 ? (
              <MileageTrend points={report.mileage} average={report.kmPerLitre} unit={mileageUnit} />
            ) : (
              <p className="hint">Needs at least two full-tank intervals in the year.</p>
            )}
          </section>
        </>
      )}

      {kind !== 'week' && (
        <section className="card">
          <div className="card-head">
            <h2>{kind === 'year' ? 'Service timeline' : 'Services done'}</h2>
          </div>
          {services.length === 0 ? (
            <p className="hint">No services in this period.</p>
          ) : (
            <ol className={kind === 'year' ? 'timeline' : 'plain-list'}>
              {services.map((s) => {
                const names = data.serviceItems
                  .filter((i) => i.serviceRecordId === s.id)
                  .map((i) => data.itemTypes.find((t) => t.id === i.itemTypeId)?.name ?? 'Item')
                  .join(', ');
                return (
                  <li key={s.id}>
                    <Link to={`/service/${s.id}`} className="timeline-row">
                      <span className="row-title">
                        {formatDate(s.date)}
                        <span className="muted"> · {formatNumber(s.odometer)} {dist}</span>
                      </span>
                      <span className="row-sub">{[s.serviceCenter, names].filter(Boolean).join(' · ') || 'No items ticked'}</span>
                      <span className="row-sub">{money(s.totalCost)}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      )}
    </>
  );
}

function FillLine({ label, m, kmpl, dist }: { label: string; m: DatedMileage; kmpl: (v: number) => string; dist: string }) {
  return (
    <div className="fill-line">
      <span className="stat-label">{label}</span>
      <span className="row-title">{kmpl(m.kmPerLitre)}</span>
      <span className="row-sub">
        {formatDate(m.date)} · {formatNumber(m.distance)} {dist}
      </span>
    </div>
  );
}

/** Mileage by riding condition, for intervals that closed in the period. */
function ConditionCard({ fills, all, kmpl }: { fills: { id: number }[]; all: Parameters<typeof mileageByCondition>[0]; kmpl: (v: number) => string }) {
  // Work out over all fills so the first interval in the period still has its starting fill.
  const inPeriod = new Set(fills.map((f) => f.id));
  const rows = mileageByCondition(all.map((f) => (inPeriod.has(f.id) ? f : { ...f, conditions: undefined })));
  if (!rows.length) return null;
  const label = (k: string) => RIDING_CONDITIONS.find((c) => c.key === k)?.label ?? k;
  return (
    <section className="card">
      <div className="card-head">
        <h2>Mileage by riding</h2>
      </div>
      <ul className="plain-list">
        {rows.map((r) => (
          <li key={r.condition} className="condition-row">
            <span>{label(r.condition)}</span>
            <span className="row-title">{kmpl(r.kmPerLitre)}</span>
            <span className="row-sub">
              {r.fills} {r.fills === 1 ? 'tank' : 'tanks'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
