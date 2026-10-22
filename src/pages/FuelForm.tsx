import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChipPicker from '../components/ChipPicker';
import Toggle from '../components/Toggle';
import { db } from '../db';
import { useActiveBike, useSettings } from '../db/hooks';
import { RIDING_CONDITIONS } from '../db/types';
import { getOdometerReadings } from '../db/odometer';
import { priceFrom, totalFrom } from '../lib/calc/fuel';
import { computeMileage, sortFills, type MileageResult } from '../lib/calc/mileage';
import { checkOdometer, latestOdometer } from '../lib/calc/odometer';
import { formatDate, formatMoney, formatNumber, parseDecimal, todayISO } from '../lib/format';
import { scrollToFirstProblem } from '../lib/scrollToProblem';
import { brandsFor, fuelTypesFor, regularFuel } from '../lib/fuelCatalog';
import { unitsFor } from '../lib/units';

interface Saved {
  isFullTank: boolean;
  result?: MileageResult;
}

export default function FuelForm() {
  const params = useParams();
  const editId = params.id ? Number(params.id) : undefined;
  const navigate = useNavigate();
  const settings = useSettings();
  const bike = useActiveBike();
  const bikeId = settings?.activeBikeId;
  const fuelKind = bike?.fuelKind ?? 'petrol';

  const existing = useLiveQuery(async () => (editId ? ((await db.fuelEntries.get(editId)) ?? null) : null), [editId]);
  const fills = useLiveQuery(async () => (bikeId ? await db.fuelEntries.where('bikeId').equals(bikeId).toArray() : undefined), [bikeId]);
  const readings = useLiveQuery(async () => (bikeId ? await getOdometerReadings(bikeId) : undefined), [bikeId]);
  const stations = useLiveQuery(() => db.stations.toArray(), []);

  const [date, setDate] = useState(todayISO());
  const [odometer, setOdometer] = useState('');
  const [litres, setLitres] = useState('');
  const [price, setPrice] = useState('');
  const [total, setTotal] = useState('');
  const [isFullTank, setIsFullTank] = useState(true);
  const [station, setStation] = useState('');
  const [brand, setBrand] = useState<string>('');
  const [fuelType, setFuelType] = useState<string>('');
  const [conditions, setConditions] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [confirmLowOdometer, setConfirmLowOdometer] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [formKey, setFormKey] = useState(0);
  const initialized = useRef(false);

  // Fill the form once, from the record being edited or from the latest values.
  useEffect(() => {
    if (initialized.current || !fills || !readings || !stations || existing === undefined) return;
    if (editId) {
      if (!existing) {
        navigate('/log', { replace: true });
        return;
      }
      setDate(existing.date);
      setOdometer(String(existing.odometer));
      setLitres(String(existing.litres));
      setPrice(String(existing.pricePerLitre));
      setTotal(String(existing.totalCost));
      setIsFullTank(existing.isFullTank);
      setStation(stations.find((s) => s.id === existing.stationId)?.name ?? '');
      setBrand(existing.brand ?? '');
      setFuelType(existing.fuelType ?? '');
      setConditions(existing.conditions ?? []);
      setNotes(existing.notes);
    } else {
      const latest = latestOdometer(readings);
      if (latest != null) setOdometer(String(latest));
      const last = sortFills(fills).at(-1);
      if (last) setPrice(String(last.pricePerLitre));
      // Most people fill the same fuel at the same company, so start from the last fill.
      setBrand(last?.brand ?? '');
      setFuelType(last?.fuelType ?? regularFuel(fuelKind));
      setConditions(last?.conditions ?? []);
    }
    initialized.current = true;
  }, [editId, existing, fills, readings, stations, navigate, formKey, fuelKind]);

  const recentStations = useMemo(() => {
    if (!fills || !stations) return [];
    const ids: number[] = [];
    for (const f of [...fills].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)) {
      if (f.stationId != null && !ids.includes(f.stationId)) ids.push(f.stationId);
      if (ids.length === 4) break;
    }
    return ids.map((id) => stations.find((s) => s.id === id)).filter((s) => s !== undefined);
  }, [fills, stations]);

  if (!settings) return null;
  const units = unitsFor(settings, bike);
  const cur = units.currency;
  const dist = units.distance;
  const fuel = units.fuel;
  const types = fuelTypesFor(fuelKind, brand || undefined);
  const chosenType = types.find((t) => t.key === fuelType);

  function chooseBrand(next: string) {
    const b = brand === next ? '' : next;
    setBrand(b);
    // Keep the fuel if this company sells it; otherwise fall back to the regular grade.
    if (!fuelTypesFor(fuelKind, b || undefined).some((t) => t.key === fuelType)) setFuelType(regularFuel(fuelKind));
  }

  function chooseStation(name: string) {
    const next = station === name ? '' : name;
    setStation(next);
    const s = stations?.find((x) => x.name === next);
    if (s?.brand && s.brand !== brand) chooseBrand(s.brand);
  }

  const odo = parseDecimal(odometer);
  const l = parseDecimal(litres);
  const p = parseDecimal(price);
  const t = parseDecimal(total);

  const errors: Record<string, string> = {};
  if (!date) errors.date = 'Pick a date.';
  if (odo == null) errors.odometer = 'Enter the odometer reading.';
  if (!l) errors.litres = `${fuel} must be more than 0.`;
  if (!p) errors.price = 'Price must be more than 0.';
  if (!t) errors.total = 'Total must be more than 0.';

  // Tank size lets us catch a typo like 170 instead of 17.0 litres.
  const overTank = bike?.tankCapacity && l ? l > bike.tankCapacity * 1.05 : false;

  const odoCheck = readings && odo != null ? checkOdometer(readings, date, odo, editId ? { source: 'fuel', id: editId } : undefined) : null;
  const odoLow = odoCheck !== null && !odoCheck.ok;

  function onLitres(v: string) {
    setLitres(v);
    const nl = parseDecimal(v);
    if (nl && p) setTotal(String(totalFrom(nl, p)));
  }
  function onPrice(v: string) {
    setPrice(v);
    const np = parseDecimal(v);
    if (np && l) setTotal(String(totalFrom(l, np)));
  }
  function onTotal(v: string) {
    setTotal(v);
    const nt = parseDecimal(v);
    if (nt && l) setPrice(String(priceFrom(nt, l)));
  }

  async function resolveStationId(): Promise<number | undefined> {
    const name = station.trim();
    if (!name) return undefined;
    const match = stations?.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (!match) return db.stations.add({ name, brand: brand || undefined });
    // Remember the company for next time this station is picked.
    if (brand && match.brand !== brand) await db.stations.update(match.id, { brand });
    return match.id;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    scrollToFirstProblem();
    if (Object.keys(errors).length > 0 || (odoLow && !confirmLowOdometer) || !bikeId || saving) return;
    setSaving(true);
    try {
      const entry = {
        bikeId,
        date,
        odometer: odo!,
        litres: l!,
        pricePerLitre: p!,
        totalCost: t!,
        isFullTank,
        stationId: await resolveStationId(),
        brand: brand || undefined,
        fuelType: fuelType || undefined,
        conditions: conditions.length ? conditions : undefined,
        notes: notes.trim(),
      };
      let id = editId;
      if (id) await db.fuelEntries.update(id, entry);
      else id = await db.fuelEntries.add(entry);

      const all = await db.fuelEntries.where('bikeId').equals(bikeId).toArray();
      setSaved({ isFullTank, result: computeMileage(all).get(id!) });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!editId || !window.confirm('Delete this fill-up? This cannot be undone.')) return;
    await db.fuelEntries.delete(editId);
    navigate('/log', { replace: true });
  }

  function logAnother() {
    initialized.current = false;
    setFormKey((k) => k + 1);
    setSaved(null);
    setSubmitted(false);
    setConfirmLowOdometer(false);
    setDate(todayISO());
    setLitres('');
    setTotal('');
    setIsFullTank(true);
    setStation('');
    setNotes('');
    navigate('/fuel/new', { replace: true });
  }

  if (saved) {
    const r = saved.result;
    return (
      <>
        <header className="page-header">
          <h1>Saved</h1>
        </header>
        <section className="card result">
          {r ? (
            <>
              <p className="big-number">
                {formatNumber(r.kmPerLitre, 1)} <span>{units.mileage}</span>
              </p>
              <p>
                {formatNumber(r.distance)} {dist} on {formatNumber(r.litres, 2)} {fuel} · {formatMoney(r.costPerKm, cur)} per {dist}
              </p>
            </>
          ) : saved.isFullTank ? (
            <p>Full tank recorded. Mileage appears after your next full-tank fill.</p>
          ) : (
            <p>Partial fill recorded. It counts towards the mileage of your next full-tank fill.</p>
          )}
        </section>
        <div className="bottom-actions">
          <button type="button" className="btn" onClick={logAnother}>
            Log another
          </button>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/log', { replace: true })}>
            Done
          </button>
        </div>
      </>
    );
  }

  const show = (key: string) => submitted && errors[key] && <span className="error">{errors[key]}</span>;

  return (
    <form onSubmit={onSubmit} noValidate>
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/log'))}>
          Cancel
        </button>
        <h1>{editId ? 'Edit fuel' : 'Add fuel'}</h1>
      </header>

      <div className="card form">
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          {show('date')}
        </label>

        <label className="field">
          <span>Odometer ({dist})</span>
          <input
            inputMode="numeric"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            placeholder="0"
          />
          {show('odometer')}
        </label>
        {odoLow && odoCheck?.previous && (
          <div className="warning">
            <p>
              This is lower than {formatNumber(odoCheck.previous.odometer)} {dist}, recorded on {formatDate(odoCheck.previous.date)}.
            </p>
            <label className="check">
              <input type="checkbox" checked={confirmLowOdometer} onChange={(e) => setConfirmLowOdometer(e.target.checked)} />
              <span>The reading is correct, save anyway</span>
            </label>
          </div>
        )}

        <div className="field-row">
          <label className="field">
            <span>{fuel === 'L' ? 'Litres' : fuel === 'kg' ? 'Kilograms' : fuel}</span>
            <input inputMode="decimal" value={litres} onChange={(e) => onLitres(e.target.value)} placeholder="0.00" />
            {show('litres')}
            {overTank && <span className="error">More than your {bike!.tankCapacity} {fuel} tank. Check the number.</span>}
          </label>
          <label className="field">
            <span>Price / {fuel}</span>
            <input inputMode="decimal" value={price} onChange={(e) => onPrice(e.target.value)} placeholder="0.00" />
            {show('price')}
          </label>
        </div>

        <label className="field">
          <span>Total ({cur})</span>
          <input inputMode="decimal" value={total} onChange={(e) => onTotal(e.target.value)} placeholder="0.00" />
          {show('total')}
        </label>

        <Toggle label="Full tank" hint="Mileage is measured between full tanks" checked={isFullTank} onChange={setIsFullTank} />
        <div className="field">
          <span>{bike?.kind === 'car' ? 'How you drove' : 'How you rode'} since the last fill</span>
          <ChipPicker
            label="Riding conditions"
            options={RIDING_CONDITIONS.map((c) => ({ value: c.key, label: c.label }))}
            selected={conditions}
            onToggle={(k) => setConditions((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]))}
          />
          <span className="hint">Reports compare your mileage in each.</span>
        </div>
      </div>

      <div className="card form">
        <div className="field">
          <span>Fuel company</span>
          <ChipPicker label="Fuel company" options={brandsFor(fuelKind).map((b) => ({ value: b.key, label: b.short }))} selected={[brand]} onToggle={chooseBrand} />
        </div>
        <div className="field">
          <span>Fuel</span>
          <ChipPicker label="Fuel" options={types.map((t) => ({ value: t.key, label: t.name }))} selected={[fuelType]} onToggle={(k) => setFuelType(k)} />
          {chosenType?.note && <span className="hint">{chosenType.note}</span>}
        </div>
        <label className="field">
          <span>Station or outlet</span>
          <input list="stations" value={station} onChange={(e) => setStation(e.target.value)} placeholder="e.g. HP, Ring Road" autoComplete="off" />
          <datalist id="stations">
            {stations?.map((s) => <option key={s.id} value={s.name} />)}
          </datalist>
        </label>
        {recentStations.length > 0 && (
          <div className="chips" aria-label="Recent stations">
            {recentStations.map((s) => (
              <button key={s.id} type="button" className={station === s.name ? 'chip active' : 'chip'} onClick={() => chooseStation(s.name)}>
                {s.name}
              </button>
            ))}
          </div>
        )}
        <label className="field">
          <span>Notes</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      {editId && (
        <button type="button" className="btn btn-danger-plain" onClick={onDelete}>
          Delete fill-up
        </button>
      )}

      <div className="bottom-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {editId ? 'Save changes' : 'Save'}
        </button>
      </div>
    </form>
  );
}
