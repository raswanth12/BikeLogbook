import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PlusIcon } from '../components/Icons';
import LogFilters, { useLogFilter } from '../components/LogFilters';
import ShowMore, { usePaged } from '../components/ShowMore';
import { db } from '../db';
import { useActiveBike, useSettings } from '../db/hooks';
import { brandShort, fuelTypeName } from '../lib/fuelCatalog';
import { unitsFor } from '../lib/units';
import { computeMileage, mileageSeries, sortFills, summarizeMileage } from '../lib/calc/mileage';
import { formatDate, formatMoney, formatNumber } from '../lib/format';

export default function FuelList() {
  const settings = useSettings();
  const bike = useActiveBike();
  const bikeId = settings?.activeBikeId;
  const fills = useLiveQuery(() => (bikeId ? db.fuelEntries.where('bikeId').equals(bikeId).toArray() : []), [bikeId]);
  const stations = useLiveQuery(() => db.stations.toArray(), []);
  const filter = useLogFilter();

  const stationName = useMemo(() => new Map((stations ?? []).map((s) => [s.id, s.name])), [stations]);
  const mileage = useMemo(() => computeMileage(fills ?? []), [fills]);
  const summary = useMemo(() => summarizeMileage(mileageSeries(fills ?? [])), [fills]);

  const visible = sortFills(fills ?? [])
    .reverse()
    .filter((f) => filter.matches(f.date, `${stationName.get(f.stationId ?? -1) ?? ''} ${brandShort(f.brand)} ${fuelTypeName(f.fuelType)} ${f.notes}`));
  const page = usePaged(visible, `${filter.query}|${filter.from}|${filter.to}`);

  if (!settings || !fills) return null;
  const units = unitsFor(settings, bike);
  const cur = units.currency;
  const mUnit = units.mileage;

  return (
    <>
      {fills.length === 0 ? (
        <div className="empty">
          <p>No fill-ups yet.</p>
          <p className="hint">Log a full tank, then another one. Mileage appears from the second full fill.</p>
        </div>
      ) : (
        <>
          <div className="stat-row">
            <div className="stat">
              <span className="stat-label">Average</span>
              <span className="stat-value">{summary.overallKmPerLitre ? `${formatNumber(summary.overallKmPerLitre, 1)} ${mUnit}` : '—'}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Last 5</span>
              <span className="stat-value">{summary.last5KmPerLitre ? `${formatNumber(summary.last5KmPerLitre, 1)} ${mUnit}` : '—'}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Fuel / {settings.distanceUnit}</span>
              <span className="stat-value">{summary.overallCostPerKm ? formatMoney(summary.overallCostPerKm, cur) : '—'}</span>
            </div>
          </div>

          <LogFilters filter={filter} placeholder="Search station, company, fuel or notes" />

          <ul className="list">
            {page.visible.map((f) => {
              const m = mileage.get(f.id);
              const station = f.stationId != null ? stationName.get(f.stationId) : undefined;
              return (
                <li key={f.id}>
                  <Link to={`/fuel/${f.id}`} className="list-row">
                    <div className="row-main">
                      <span className="row-title">
                        {formatDate(f.date)}
                        {(station || f.brand) && <span className="muted"> · {station || brandShort(f.brand)}</span>}
                      </span>
                      <span className="row-sub">
                        {formatNumber(f.odometer)} {settings.distanceUnit} · {formatNumber(f.litres, 2)} {units.fuel}
                        {f.fuelType && f.fuelType !== 'petrol' && <span className="badge">{fuelTypeName(f.fuelType)}</span>}
                        {!f.isFullTank && <span className="badge">Partial</span>}
                      </span>
                    </div>
                    <div className="row-side">
                      <span className="row-title">{formatMoney(f.totalCost, cur)}</span>
                      <span className="row-sub accent">{m ? `${formatNumber(m.kmPerLitre, 1)} ${mUnit}` : ''}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
            {visible.length === 0 && <li className="empty">No fill-ups match.</li>}
          </ul>
          <ShowMore remaining={page.remaining} onMore={page.more} />
        </>
      )}
      <Link to="/fuel/new" className="fab" aria-label="Log fuel">
        <PlusIcon />
      </Link>
    </>
  );
}
