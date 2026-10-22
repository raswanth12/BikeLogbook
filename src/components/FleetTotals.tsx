import { useMemo } from 'react';
import type { Settings } from '../db/types';
import { useFleet } from '../db/useFleet';
import { buildReport } from '../lib/calc/periods';
import { formatMoney, formatNumber } from '../lib/format';
import SpendSplitBar from './SpendSplitBar';

/** Each vehicle's spend and km for the period, then everything added together. */
export default function FleetTotals({ start, end, settings }: { start: string; end: string; settings: Settings }) {
  const fleet = useFleet();
  const rows = useMemo(() => (fleet ?? []).map((v) => ({ bike: v.bike, report: buildReport(v.input, start, end) })), [fleet, start, end]);
  if (!fleet || fleet.length < 2) return null;

  const cur = settings.currencySymbol;
  const dist = settings.distanceUnit;
  const money = (v: number) => formatMoney(v, cur, 0);
  const sum = (pick: (r: (typeof rows)[number]['report']) => number) => rows.reduce((s, r) => s + pick(r.report), 0);
  const total = {
    fuel: sum((r) => r.spend.fuel),
    service: sum((r) => r.spend.service),
    accessories: sum((r) => r.spend.accessories),
    other: sum((r) => r.spend.other),
    insurance: sum((r) => r.spend.insurance),
    total: sum((r) => r.spend.total),
  };
  const km = sum((r) => r.km);

  return (
    <>
      <h2 className="section-title">All vehicles</h2>
      <section className="card">
        <ul className="plain-list">
          {rows.map(({ bike, report }) => (
            <li key={bike.id} className="fleet-row">
              <div className="fleet-head">
                <span className="row-title">{bike.name}</span>
                <span className="row-title">{money(report.spend.total)}</span>
              </div>
              <span className="row-sub">
                {formatNumber(report.km)} {dist} · Fuel {money(report.spend.fuel)} · Service {money(report.spend.service)} · Insurance {money(report.spend.insurance)} · Other{' '}
                {money(report.spend.other + report.spend.accessories)}
              </span>
            </li>
          ))}
        </ul>
        <div className="fleet-total">
          <div className="card-head">
            <h2>Together</h2>
            <span className="card-total">{money(total.total)}</span>
          </div>
          <p className="row-sub">
            {formatNumber(km)} {dist} across {rows.length} vehicles{km > 0 && total.total > 0 ? ` · ${formatMoney(total.total / km, cur)} per ${dist}` : ''}
          </p>
          {total.total > 0 && <SpendSplitBar split={total} currency={cur} />}
        </div>
      </section>
    </>
  );
}
