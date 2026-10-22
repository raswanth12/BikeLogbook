import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChipPicker from '../components/ChipPicker';
import FormHeader from '../components/FormHeader';
import { CameraIcon } from '../components/Icons';
import OdometerWarning from '../components/OdometerWarning';
import PhotoThumb from '../components/PhotoThumb';
import { db } from '../db';
import { useSettings } from '../db/hooks';
import { getOdometerReadings } from '../db/odometer';
import { ACCESSORY_CATEGORY_LABELS, type AccessoryCategory } from '../db/types';
import { checkOdometer } from '../lib/calc/odometer';
import { parseDecimal, todayISO } from '../lib/format';
import { compressImage } from '../lib/photos';
import { scrollToFirstProblem } from '../lib/scrollToProblem';

const BACK = '/log?tab=accessories';
const CATEGORIES = Object.entries(ACCESSORY_CATEGORY_LABELS).map(([value, label]) => ({ value: value as AccessoryCategory, label }));

export default function AccessoryForm() {
  const params = useParams();
  const editId = params.id ? Number(params.id) : undefined;
  const navigate = useNavigate();
  const settings = useSettings();
  const bikeId = settings?.activeBikeId;

  const existing = useLiveQuery(async () => {
    if (!editId) return null;
    const a = await db.accessories.get(editId);
    if (!a) return null;
    return { accessory: a, photo: a.photoId != null ? await db.photos.get(a.photoId) : undefined };
  }, [editId]);
  const accessories = useLiveQuery(async () => (bikeId ? await db.accessories.where('bikeId').equals(bikeId).toArray() : undefined), [bikeId]);
  const readings = useLiveQuery(async () => (bikeId ? await getOdometerReadings(bikeId) : undefined), [bikeId]);

  const [date, setDate] = useState(todayISO());
  const [name, setName] = useState('');
  const [category, setCategory] = useState<AccessoryCategory>('protection');
  const [price, setPrice] = useState('');
  const [shop, setShop] = useState('');
  const [odometer, setOdometer] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [photoStatus, setPhotoStatus] = useState('');
  const [confirmLow, setConfirmLow] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || existing === undefined) return;
    if (editId) {
      if (!existing) {
        navigate(BACK, { replace: true });
        return;
      }
      const a = existing.accessory;
      setDate(a.date);
      setName(a.name);
      setCategory(a.category);
      setPrice(String(a.price));
      setShop(a.shop);
      setOdometer(a.odometer != null ? String(a.odometer) : '');
      setNotes(a.notes);
      setPhoto(existing.photo?.blob ?? null);
    }
    initialized.current = true;
  }, [editId, existing, navigate]);

  const shops = useMemo(() => [...new Set((accessories ?? []).map((a) => a.shop.trim()).filter(Boolean))], [accessories]);

  if (!settings) return null;
  const cur = settings.currencySymbol;
  const dist = settings.distanceUnit;
  const p = parseDecimal(price);
  const odo = odometer.trim() ? parseDecimal(odometer) : undefined;

  const errors: Record<string, string> = {};
  if (!date) errors.date = 'Pick a date.';
  if (!name.trim()) errors.name = 'What did you buy?';
  if (!p) errors.price = 'Price must be more than 0.';
  if (odo === null) errors.odometer = 'Enter a number, or leave it blank.';

  const check = readings && odo != null ? checkOdometer(readings, date, odo, editId ? { source: 'accessory', id: editId } : undefined) : null;
  const low = check !== null && !check.ok;
  const show = (key: string) => submitted && errors[key] && <span className="error">{errors[key]}</span>;

  async function onPickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoStatus('Adding photo…');
    try {
      setPhoto(await compressImage(file));
      setPhotoChanged(true);
      setPhotoStatus('');
    } catch {
      setPhotoStatus("Couldn't read that photo. Try another.");
    }
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setSubmitted(true);
    scrollToFirstProblem();
    if (Object.keys(errors).length > 0 || (low && !confirmLow) || !bikeId || saving) return;
    setSaving(true);
    try {
      await db.transaction('rw', db.accessories, db.photos, async () => {
        const oldPhotoId = existing?.accessory.photoId;
        let photoId = oldPhotoId;
        if (photoChanged) {
          if (oldPhotoId != null) await db.photos.delete(oldPhotoId);
          photoId = photo ? await db.photos.add({ blob: photo, createdAt: Date.now() }) : undefined;
        }
        const accessory = {
          bikeId,
          date,
          name: name.trim(),
          category,
          price: p!,
          shop: shop.trim(),
          odometer: odo ?? undefined,
          photoId,
          notes: notes.trim(),
        };
        if (editId) await db.accessories.update(editId, accessory);
        else await db.accessories.add(accessory);
      });
      navigate(BACK, { replace: true });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!editId || !existing || !window.confirm('Delete this accessory? This cannot be undone.')) return;
    await db.transaction('rw', db.accessories, db.photos, async () => {
      if (existing.accessory.photoId != null) await db.photos.delete(existing.accessory.photoId);
      await db.accessories.delete(editId);
    });
    navigate(BACK, { replace: true });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormHeader title={editId ? 'Edit accessory' : 'Add accessory'} fallback={BACK} />

      <div className="card form">
        <label className="field">
          <span>What</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Crash guard" />
          {show('name')}
        </label>
        <div className="field">
          <span>Category</span>
          <ChipPicker label="Category" options={CATEGORIES} selected={[category]} onToggle={setCategory} />
        </div>
        <div className="field-row">
          <label className="field">
            <span>Price ({cur})</span>
            <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
            {show('price')}
          </label>
          <label className="field">
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            {show('date')}
          </label>
        </div>
        <label className="field">
          <span>Shop</span>
          <input list="shops" value={shop} onChange={(e) => setShop(e.target.value)} autoComplete="off" />
          <datalist id="shops">
            {shops.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <label className="field">
          <span>Odometer ({dist}, optional)</span>
          <input inputMode="numeric" value={odometer} onChange={(e) => setOdometer(e.target.value)} />
          {show('odometer')}
        </label>
        {low && check?.previous && <OdometerWarning previous={check.previous} unit={dist} confirmed={confirmLow} onConfirm={setConfirmLow} />}
        <label className="field">
          <span>Notes</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      <h2 className="section-title">Photo</h2>
      <div className="card">
        {photo && (
          <div className="thumbs">
            <PhotoThumb
              blob={photo}
              onRemove={() => {
                setPhoto(null);
                setPhotoChanged(true);
              }}
            />
          </div>
        )}
        <label className="btn file-btn">
          <CameraIcon /> {photo ? 'Replace photo' : 'Add photo'}
          <input type="file" accept="image/*" onChange={onPickPhoto} />
        </label>
        {photoStatus && <p className="hint">{photoStatus}</p>}
      </div>

      {editId && (
        <button type="button" className="btn btn-danger-plain" onClick={onDelete}>
          Delete accessory
        </button>
      )}

      <div className="bottom-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {editId ? 'Save changes' : 'Save accessory'}
        </button>
      </div>
    </form>
  );
}
