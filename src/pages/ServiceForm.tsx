import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CameraIcon, CheckIcon, ChevronIcon } from '../components/Icons';
import PhotoThumb from '../components/PhotoThumb';
import { db } from '../db';
import { useActiveBike, useSettings } from '../db/hooks';
import { itemFitsVehicle } from '../db/seed';
import { getOdometerReadings } from '../db/odometer';
import { SERVICE_CATEGORY_LABELS, type ServiceCategory } from '../db/types';
import { checkOdometer, latestOdometer } from '../lib/calc/odometer';
import { serviceTotal } from '../lib/calc/service';
import { CATEGORY_ORDER, groupByCategory } from '../lib/catalog';
import { formatDate, formatMoney, formatNumber, parseDecimal, todayISO } from '../lib/format';
import { compressImage } from '../lib/photos';
import { nextDueAfterService } from '../lib/reminders/evaluate';
import type { ReminderRule } from '../db/types';
import { scrollToFirstProblem } from '../lib/scrollToProblem';

interface ItemDraft {
  cost: string;
  brand: string;
  note: string;
}

interface PhotoDraft {
  id?: number; // set for photos already saved
  blob: Blob;
  key: string;
}

interface ReminderUpdate {
  rule: ReminderRule;
  next: { dueOdometer?: number; dueDate?: string };
}

const emptyDraft: ItemDraft = { cost: '', brand: '', note: '' };
const isInvalid = (text: string) => text.trim() !== '' && parseDecimal(text) == null;

export default function ServiceForm() {
  const params = useParams();
  const editId = params.id ? Number(params.id) : undefined;
  const navigate = useNavigate();
  const settings = useSettings();
  const bike = useActiveBike();
  const bikeId = settings?.activeBikeId;

  const itemTypes = useLiveQuery(() => db.serviceItemTypes.orderBy('sortOrder').toArray(), []);
  const services = useLiveQuery(async () => (bikeId ? await db.serviceRecords.where('bikeId').equals(bikeId).toArray() : undefined), [bikeId]);
  const readings = useLiveQuery(async () => (bikeId ? await getOdometerReadings(bikeId) : undefined), [bikeId]);
  const existing = useLiveQuery(async () => {
    if (!editId) return null;
    const record = await db.serviceRecords.get(editId);
    if (!record) return null;
    const [items, photos] = await Promise.all([
      db.serviceItems.where('serviceRecordId').equals(editId).toArray(),
      db.photos.bulkGet(record.billPhotoIds),
    ]);
    return { record, items, photos: photos.filter((p) => p !== undefined) };
  }, [editId]);

  const [date, setDate] = useState(todayISO());
  const [odometer, setOdometer] = useState('');
  const [centre, setCentre] = useState('');
  const [labour, setLabour] = useState('');
  const [total, setTotal] = useState('');
  const [totalEdited, setTotalEdited] = useState(false);
  const [notes, setNotes] = useState('');
  const [ticked, setTicked] = useState<Record<number, ItemDraft>>({});
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<number[]>([]);
  const [photoStatus, setPhotoStatus] = useState('');
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<ServiceCategory>('general');
  const [confirmLowOdometer, setConfirmLowOdometer] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reminderUpdates, setReminderUpdates] = useState<ReminderUpdate[] | null>(null);
  const [chosenUpdates, setChosenUpdates] = useState<Set<number>>(new Set());
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !readings || existing === undefined) return;
    if (editId) {
      if (!existing) {
        navigate('/service', { replace: true });
        return;
      }
      const { record, items } = existing;
      setDate(record.date);
      setOdometer(String(record.odometer));
      setCentre(record.serviceCenter);
      setLabour(record.laborCost ? String(record.laborCost) : '');
      setTotal(String(record.totalCost));
      setTotalEdited(record.totalCost !== serviceTotal(items.map((i) => i.cost), record.laborCost));
      setNotes(record.notes);
      setTicked(Object.fromEntries(items.map((i) => [i.itemTypeId, { cost: i.cost != null ? String(i.cost) : '', brand: i.brandOrPart ?? '', note: i.note ?? '' }])));
      setPhotos(existing.photos.map((p) => ({ id: p.id, blob: p.blob, key: `saved-${p.id}` })));
    } else {
      const latest = latestOdometer(readings);
      if (latest != null) setOdometer(String(latest));
    }
    initialized.current = true;
  }, [editId, existing, readings, navigate]);

  const recentCentres = useMemo(() => {
    const names: string[] = [];
    for (const s of [...(services ?? [])].sort((a, b) => b.date.localeCompare(a.date))) {
      const n = s.serviceCenter.trim();
      if (n && !names.some((x) => x.toLowerCase() === n.toLowerCase())) names.push(n);
    }
    return names;
  }, [services]);

  if (!settings || !itemTypes) return null;
  const cur = settings.currencySymbol;
  const dist = settings.distanceUnit;

  const tickedIds = Object.keys(ticked).map(Number);
  const autoTotal = serviceTotal(tickedIds.map((id) => parseDecimal(ticked[id].cost)), parseDecimal(labour));
  const totalText = totalEdited ? total : autoTotal ? String(autoTotal) : '';
  const odo = parseDecimal(odometer);

  const errors: Record<string, string> = {};
  if (!date) errors.date = 'Pick a date.';
  if (odo == null) errors.odometer = 'Enter the odometer reading.';
  if (isInvalid(labour)) errors.labour = 'Enter a number, or leave it blank.';
  if (isInvalid(totalText)) errors.total = 'Enter a number, or leave it blank.';
  const badItem = tickedIds.find((id) => isInvalid(ticked[id].cost));
  if (badItem != null) errors.items = 'One of the item costs is not a number.';

  const odoCheck = readings && odo != null ? checkOdometer(readings, date, odo, editId ? { source: 'service', id: editId } : undefined) : null;
  const odoLow = odoCheck !== null && !odoCheck.ok;
  const show = (key: string) => submitted && errors[key] && <span className="error">{errors[key]}</span>;

  // Items for this kind of vehicle, plus anything already ticked on this service.
  const visibleTypes = itemTypes.filter((t) => (!t.hidden && itemFitsVehicle(t, bike?.kind)) || ticked[t.id]);

  function toggle(id: number) {
    setTicked((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = { ...emptyDraft };
      return next;
    });
    if (ticked[id]) setExpanded((prev) => new Set([...prev].filter((x) => x !== id)));
  }

  function toggleExpanded(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function updateItem(id: number, patch: Partial<ItemDraft>) {
    setTicked((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  async function addCustomItem() {
    const name = customName.trim();
    if (!name || !itemTypes) return;
    const match = itemTypes.find((t) => t.name.toLowerCase() === name.toLowerCase());
    const id =
      match?.id ??
      (await db.serviceItemTypes.add({
        name,
        category: customCategory,
        isCustom: true,
        hidden: false,
        kinds: bike?.kind ? [bike.kind] : undefined,
        sortOrder: Math.max(0, ...itemTypes.map((t) => t.sortOrder)) + 1,
      }));
    setTicked((prev) => ({ ...prev, [id]: prev[id] ?? { ...emptyDraft } }));
    setCustomName('');
  }

  async function onPickPhotos(e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])];
    e.target.value = '';
    if (!files.length) return;
    setPhotoStatus('Adding photos…');
    try {
      const blobs = await Promise.all(files.map(compressImage));
      setPhotos((prev) => [...prev, ...blobs.map((blob, i) => ({ blob, key: `new-${Date.now()}-${i}` }))]);
      setPhotoStatus('');
    } catch {
      setPhotoStatus("Couldn't read one of the photos. Try another.");
    }
  }

  function removePhoto(p: PhotoDraft) {
    setPhotos((prev) => prev.filter((x) => x.key !== p.key));
    if (p.id != null) setRemovedPhotoIds((prev) => [...prev, p.id!]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    scrollToFirstProblem();
    if (Object.keys(errors).length > 0 || (odoLow && !confirmLowOdometer) || !bikeId || saving) return;
    setSaving(true);
    try {
      await db.transaction('rw', db.serviceRecords, db.serviceItems, db.photos, async () => {
        const newIds: number[] = [];
        for (const p of photos) if (p.id == null) newIds.push(await db.photos.add({ blob: p.blob, createdAt: Date.now() }));
        if (removedPhotoIds.length) await db.photos.bulkDelete(removedPhotoIds);

        const record = {
          bikeId,
          date,
          odometer: odo!,
          serviceCenter: centre.trim(),
          laborCost: parseDecimal(labour) ?? 0,
          totalCost: parseDecimal(totalText) ?? 0,
          notes: notes.trim(),
          billPhotoIds: [...photos.filter((p) => p.id != null).map((p) => p.id!), ...newIds],
        };
        let id = editId;
        if (id) await db.serviceRecords.update(id, record);
        else id = await db.serviceRecords.add(record);

        await db.serviceItems.where('serviceRecordId').equals(id!).delete();
        await db.serviceItems.bulkAdd(
          tickedIds.map((itemTypeId) => ({
            serviceRecordId: id!,
            itemTypeId,
            cost: parseDecimal(ticked[itemTypeId].cost) ?? undefined,
            brandOrPart: ticked[itemTypeId].brand.trim() || undefined,
            note: ticked[itemTypeId].note.trim() || undefined,
          })),
        );
      });

      // Offer to move linked reminders on, e.g. oil next due at this reading + its interval.
      const linked = await db.reminderRules
        .where('bikeId')
        .equals(bikeId)
        .filter((r) => r.active && r.linkedItemTypeId != null && tickedIds.includes(r.linkedItemTypeId))
        .toArray();
      const updates = linked
        .map((rule) => ({ rule, next: nextDueAfterService(rule, itemTypes!.find((t) => t.id === rule.linkedItemTypeId), odo!, date) }))
        .filter((u): u is ReminderUpdate => u.next !== null);
      if (updates.length) {
        setReminderUpdates(updates);
        setChosenUpdates(new Set(updates.map((u) => u.rule.id)));
      } else {
        navigate('/service', { replace: true });
      }
    } finally {
      setSaving(false);
    }
  }

  async function applyReminderUpdates() {
    await db.transaction('rw', db.reminderRules, async () => {
      for (const u of reminderUpdates ?? []) {
        if (chosenUpdates.has(u.rule.id)) await db.reminderRules.update(u.rule.id, { dueOdometer: u.next.dueOdometer, dueDate: u.next.dueDate });
      }
    });
    navigate('/service', { replace: true });
  }

  async function onDelete() {
    if (!editId || !existing || !window.confirm('Delete this service and its photos? This cannot be undone.')) return;
    await db.transaction('rw', db.serviceRecords, db.serviceItems, db.photos, async () => {
      await db.serviceItems.where('serviceRecordId').equals(editId).delete();
      await db.photos.bulkDelete(existing.record.billPhotoIds);
      await db.serviceRecords.delete(editId);
    });
    navigate('/service', { replace: true });
  }

  if (reminderUpdates) {
    return (
      <>
        <header className="page-header">
          <h1>Service saved</h1>
        </header>
        <h2 className="section-title">Update reminders?</h2>
        <ul className="list">
          {reminderUpdates.map((u) => {
            const targets = [u.next.dueOdometer != null ? `${formatNumber(u.next.dueOdometer)} ${dist}` : null, u.next.dueDate ? formatDate(u.next.dueDate) : null]
              .filter(Boolean)
              .join(' or ');
            return (
              <li key={u.rule.id}>
                <label className="list-row check-option">
                  <input
                    type="checkbox"
                    checked={chosenUpdates.has(u.rule.id)}
                    onChange={(e) =>
                      setChosenUpdates((prev) => {
                        const next = new Set(prev);
                        if (e.target.checked) next.add(u.rule.id);
                        else next.delete(u.rule.id);
                        return next;
                      })
                    }
                  />
                  <span className="row-main">
                    <span className="row-title">{u.rule.title}</span>
                    <span className="row-sub">Next due at {targets}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <div className="bottom-actions">
          <button type="button" className="btn" onClick={() => navigate('/service', { replace: true })}>
            Skip
          </button>
          <button type="button" className="btn btn-primary" onClick={applyReminderUpdates} disabled={chosenUpdates.size === 0}>
            Update {chosenUpdates.size || ''}
          </button>
        </div>
      </>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/service'))}>
          Cancel
        </button>
        <h1>{editId ? 'Edit service' : 'New service'}</h1>
      </header>

      <div className="card form">
        <div className="field-row">
          <label className="field">
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            {show('date')}
          </label>
          <label className="field">
            <span>Odometer ({dist})</span>
            <input inputMode="numeric" value={odometer} onChange={(e) => setOdometer(e.target.value)} onFocus={(e) => e.currentTarget.select()} />
            {show('odometer')}
          </label>
        </div>
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
        <label className="field">
          <span>Service centre</span>
          <input list="centres" value={centre} onChange={(e) => setCentre(e.target.value)} placeholder="Where was it done?" autoComplete="off" />
          <datalist id="centres">
            {recentCentres.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        {recentCentres.length > 0 && (
          <div className="chips" aria-label="Recent service centres">
            {recentCentres.slice(0, 3).map((c) => (
              <button key={c} type="button" className={centre === c ? 'chip active' : 'chip'} onClick={() => setCentre(centre === c ? '' : c)}>
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      <h2 className="section-title">What was done {tickedIds.length > 0 && <span className="count">· {tickedIds.length}</span>}</h2>
      {show('items')}
      {groupByCategory(visibleTypes).map((group) => (
        <section key={group.category} className="checklist-group">
          <h3>{SERVICE_CATEGORY_LABELS[group.category]}</h3>
          <ul className="list checklist">
            {group.items.map((t) => {
              const draft = ticked[t.id];
              const open = draft && expanded.has(t.id);
              const cost = draft ? parseDecimal(draft.cost) : null;
              return (
                <li key={t.id} className={draft ? 'check-row ticked' : 'check-row'}>
                  <div className="check-line">
                    <button type="button" className="check-main" aria-pressed={!!draft} onClick={() => toggle(t.id)}>
                      <span className="checkbox" aria-hidden="true">
                        {draft && <CheckIcon />}
                      </span>
                      <span className="check-name">{t.name}</span>
                      {cost != null && <span className="check-cost">{formatMoney(cost, cur, 0)}</span>}
                    </button>
                    {draft && (
                      <button
                        type="button"
                        className={open ? 'check-more open' : 'check-more'}
                        aria-expanded={!!open}
                        aria-label={`Details for ${t.name}`}
                        onClick={() => toggleExpanded(t.id)}
                      >
                        <ChevronIcon />
                      </button>
                    )}
                  </div>
                  {open && (
                    <div className="check-details">
                      <div className="field-row">
                        <label className="field">
                          <span>Cost ({cur})</span>
                          <input inputMode="decimal" value={draft.cost} onChange={(e) => updateItem(t.id, { cost: e.target.value })} />
                        </label>
                        <label className="field">
                          <span>Brand or part</span>
                          <input value={draft.brand} onChange={(e) => updateItem(t.id, { brand: e.target.value })} />
                        </label>
                      </div>
                      <label className="field">
                        <span>Note</span>
                        <input value={draft.note} onChange={(e) => updateItem(t.id, { note: e.target.value })} />
                      </label>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div className="card form">
        <span className="hint">Not in the list?</span>
        <div className="field-row">
          <input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Add a custom item" aria-label="Custom item name" />
          <select value={customCategory} onChange={(e) => setCustomCategory(e.target.value as ServiceCategory)} aria-label="Category">
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>
                {SERVICE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn" onClick={addCustomItem} disabled={!customName.trim()}>
          Add and tick
        </button>
      </div>

      <h2 className="section-title">Cost</h2>
      <div className="card form">
        <div className="field-row">
          <label className="field">
            <span>Labour ({cur})</span>
            <input inputMode="decimal" value={labour} onChange={(e) => setLabour(e.target.value)} placeholder="0" />
            {show('labour')}
          </label>
          <label className="field">
            <span>Total ({cur})</span>
            <input
              inputMode="decimal"
              value={totalText}
              placeholder="0"
              onChange={(e) => {
                setTotal(e.target.value);
                setTotalEdited(true);
              }}
            />
            {show('total')}
          </label>
        </div>
        {totalEdited && parseDecimal(totalText) !== autoTotal && (
          <button type="button" className="btn-link align-start" onClick={() => setTotalEdited(false)}>
            Use items + labour ({formatMoney(autoTotal, cur)})
          </button>
        )}
        <label className="field">
          <span>Notes</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      <h2 className="section-title">Bill photos</h2>
      <div className="card">
        {photos.length > 0 && (
          <div className="thumbs">
            {photos.map((p) => (
              <PhotoThumb key={p.key} blob={p.blob} onRemove={() => removePhoto(p)} />
            ))}
          </div>
        )}
        <label className="btn file-btn">
          <CameraIcon /> Add photo
          <input type="file" accept="image/*" multiple onChange={onPickPhotos} />
        </label>
        {photoStatus && <p className="hint">{photoStatus}</p>}
      </div>

      {editId && (
        <button type="button" className="btn btn-danger-plain" onClick={onDelete}>
          Delete service
        </button>
      )}

      <div className="bottom-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {editId ? 'Save changes' : 'Save service'}
        </button>
      </div>
    </form>
  );
}
