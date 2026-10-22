import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChipPicker from '../components/ChipPicker';
import FormHeader from '../components/FormHeader';
import { db } from '../db';
import { useSettings } from '../db/hooks';
import { FUEL_KIND_LABELS, VEHICLE_KIND_LABELS, type FuelKind, type VehicleKind } from '../db/types';
import { parseDecimal } from '../lib/format';
import { scrollToFirstProblem } from '../lib/scrollToProblem';

const BACK = '/settings/vehicles';
const KINDS = Object.entries(VEHICLE_KIND_LABELS).map(([value, label]) => ({ value: value as VehicleKind, label }));
const FUELS = Object.entries(FUEL_KIND_LABELS).map(([value, label]) => ({ value: value as FuelKind, label }));
const str = (n?: number) => (n != null && n !== 0 ? String(n) : '');

/** Deletes a vehicle and everything logged for it, photos included. */
async function deleteVehicle(id: number) {
  await db.transaction('rw', db.tables, async () => {
    const services = await db.serviceRecords.where('bikeId').equals(id).toArray();
    const accessories = await db.accessories.where('bikeId').equals(id).toArray();
    const policies = await db.insurancePolicies.where('bikeId').equals(id).toArray();
    const photoIds = [
      ...services.flatMap((s) => s.billPhotoIds),
      ...accessories.map((a) => a.photoId).filter((p): p is number => p != null),
      ...policies.map((p) => p.photoId).filter((p): p is number => p != null),
    ];
    await db.photos.bulkDelete(photoIds);
    if (services.length) await db.serviceItems.where('serviceRecordId').anyOf(services.map((s) => s.id)).delete();
    for (const table of [db.fuelEntries, db.trips, db.serviceRecords, db.accessories, db.expenses, db.reminderRules, db.insurancePolicies]) {
      await table.where('bikeId').equals(id).delete();
    }
    await db.bikes.delete(id);
  });
}

export default function VehicleForm() {
  const params = useParams();
  const editId = params.id ? Number(params.id) : undefined;
  const navigate = useNavigate();
  const settings = useSettings();
  const existing = useLiveQuery(async () => (editId ? ((await db.bikes.get(editId)) ?? null) : null), [editId]);
  const count = useLiveQuery(() => db.bikes.count(), []);

  const [name, setName] = useState('');
  const [kind, setKind] = useState<VehicleKind>('motorcycle');
  const [fuelKind, setFuelKind] = useState<FuelKind>('petrol');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [registration, setRegistration] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [purchaseOdometer, setPurchaseOdometer] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [tank, setTank] = useState('');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || existing === undefined) return;
    if (editId) {
      if (!existing) {
        navigate(BACK, { replace: true });
        return;
      }
      setName(existing.name);
      setKind(existing.kind ?? 'motorcycle');
      setFuelKind(existing.fuelKind ?? 'petrol');
      setMake(existing.make);
      setModel(existing.model);
      setYear(str(existing.year));
      setRegistration(existing.registration);
      setPurchaseDate(existing.purchaseDate ?? '');
      setPurchaseOdometer(str(existing.purchaseOdometer));
      setPurchasePrice(str(existing.purchasePrice));
      setTank(str(existing.tankCapacity));
      setNotes(existing.notes);
    }
    initialized.current = true;
  }, [editId, existing, navigate]);

  if (!settings || count === undefined) return null;
  const cur = settings.currencySymbol;
  const nums = { year, purchaseOdometer, purchasePrice, tank };
  const errors: Record<string, string> = {};
  if (!name.trim()) errors.name = 'Give it a name, like "Himalayan" or "Family car".';
  if (Object.values(nums).some((v) => v.trim() && parseDecimal(v) == null)) errors.numbers = 'Year, odometer, price and tank must be numbers, or blank.';
  const show = (key: string) => submitted && errors[key] && <span className="error">{errors[key]}</span>;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    scrollToFirstProblem();
    if (Object.keys(errors).length) return;
    const vehicle = {
      name: name.trim(),
      kind,
      fuelKind,
      make: make.trim(),
      model: model.trim(),
      year: parseDecimal(year) ?? undefined,
      registration: registration.trim().toUpperCase(),
      purchaseDate: purchaseDate || undefined,
      purchaseOdometer: parseDecimal(purchaseOdometer) ?? 0,
      purchasePrice: parseDecimal(purchasePrice) ?? undefined,
      tankCapacity: parseDecimal(tank) ?? undefined,
      notes: notes.trim(),
    };
    if (editId) {
      await db.bikes.update(editId, vehicle);
      navigate(BACK, { replace: true });
    } else {
      // A new vehicle becomes the active one, so you can start logging for it straight away.
      const id = await db.bikes.add(vehicle);
      await db.settings.update(1, { activeBikeId: id });
      navigate('/', { replace: true });
    }
  }

  async function onDelete() {
    if (!editId || !existing) return;
    if (!window.confirm(`Delete ${existing.name} and everything logged for it: fill-ups, services, trips, expenses, insurance and photos? This cannot be undone.`)) return;
    await deleteVehicle(editId);
    if (settings!.activeBikeId === editId) {
      const next = await db.bikes.toCollection().first();
      if (next) await db.settings.update(1, { activeBikeId: next.id });
    }
    navigate(BACK, { replace: true });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormHeader title={editId ? 'Edit vehicle' : 'Add vehicle'} fallback={BACK} />

      <div className="card form">
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Himalayan 450, Family car" />
          {show('name')}
        </label>
        <div className="field">
          <span>Type</span>
          <ChipPicker label="Vehicle type" options={KINDS} selected={[kind]} onToggle={setKind} />
        </div>
        <div className="field">
          <span>Runs on</span>
          <ChipPicker label="Fuel" options={FUELS} selected={[fuelKind]} onToggle={setFuelKind} />
          <span className="hint">Sets the fuel types you can pick, and the service checklist suits the vehicle type.</span>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Fuel tank ({fuelKind === 'cng' ? 'kg' : settings.fuelUnit})</span>
            <input inputMode="decimal" value={tank} onChange={(e) => setTank(e.target.value)} placeholder={kind === 'car' ? 'e.g. 37' : 'e.g. 17'} />
          </label>
          <label className="field">
            <span>Vehicle number (optional)</span>
            <input value={registration} onChange={(e) => setRegistration(e.target.value)} autoCapitalize="characters" placeholder="KA 01 AB 1234" />
          </label>
        </div>
        <span className="hint">The tank size works out your full-tank range and flags a fill-up bigger than the tank.</span>
        <div className="field-row">
          <label className="field">
            <span>Make</span>
            <input value={make} onChange={(e) => setMake(e.target.value)} placeholder="Royal Enfield" />
          </label>
          <label className="field">
            <span>Model</span>
            <input value={model} onChange={(e) => setModel(e.target.value)} />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Year</span>
            <input inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} />
          </label>
        </div>
      </div>

      <h2 className="section-title">Purchase</h2>
      <div className="card form">
        <div className="field-row">
          <label className="field">
            <span>Price paid ({cur})</span>
            <input inputMode="decimal" value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} placeholder="On-road price" />
          </label>
          <label className="field">
            <span>Purchase date</span>
            <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Odometer at purchase</span>
          <input inputMode="numeric" value={purchaseOdometer} onChange={(e) => setPurchaseOdometer(e.target.value)} placeholder="0" />
        </label>
        {show('numbers')}
        <label className="field">
          <span>Notes</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      {editId && count > 1 && (
        <button type="button" className="btn btn-danger-plain" onClick={onDelete}>
          Delete vehicle and its records
        </button>
      )}

      <div className="bottom-actions">
        <button type="submit" className="btn btn-primary">
          {editId ? 'Save changes' : 'Add vehicle'}
        </button>
      </div>
    </form>
  );
}
