import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChipPicker from '../components/ChipPicker';
import FormHeader from '../components/FormHeader';
import OdometerWarning from '../components/OdometerWarning';
import { db } from '../db';
import { useSettings } from '../db/hooks';
import { getOdometerReadings } from '../db/odometer';
import { DEFAULT_TRIP_TAGS } from '../db/types';
import { checkOdometer, latestOdometer } from '../lib/calc/odometer';
import { formatNumber, parseDecimal, todayISO } from '../lib/format';
import { scrollToFirstProblem } from '../lib/scrollToProblem';

const BACK = '/log?tab=trips';

export default function TripForm() {
  const params = useParams();
  const editId = params.id ? Number(params.id) : undefined;
  const navigate = useNavigate();
  const settings = useSettings();
  const bikeId = settings?.activeBikeId;

  const existing = useLiveQuery(async () => (editId ? ((await db.trips.get(editId)) ?? null) : null), [editId]);
  const trips = useLiveQuery(async () => (bikeId ? await db.trips.where('bikeId').equals(bikeId).toArray() : undefined), [bikeId]);
  const readings = useLiveQuery(async () => (bikeId ? await getOdometerReadings(bikeId) : undefined), [bikeId]);

  const [date, setDate] = useState(todayISO());
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [purpose, setPurpose] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmLow, setConfirmLow] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !readings || existing === undefined) return;
    if (editId) {
      if (!existing) {
        navigate(BACK, { replace: true });
        return;
      }
      setDate(existing.date);
      setStart(String(existing.startOdometer));
      setEnd(String(existing.endOdometer));
      setPurpose(existing.purpose);
      setTags(existing.tags);
      setNotes(existing.notes);
    } else {
      const latest = latestOdometer(readings);
      if (latest != null) setStart(String(latest));
    }
    initialized.current = true;
  }, [editId, existing, readings, navigate]);

  // Preset tags first, then any you've made up before, most used first.
  const tagOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of trips ?? []) for (const tag of t.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    const custom = [...counts.entries()].filter(([t]) => !DEFAULT_TRIP_TAGS.includes(t)).sort((a, b) => b[1] - a[1]).map(([t]) => t);
    return [...DEFAULT_TRIP_TAGS, ...custom, ...tags.filter((t) => !DEFAULT_TRIP_TAGS.includes(t) && !custom.includes(t))];
  }, [trips, tags]);

  const purposes = useMemo(() => [...new Set((trips ?? []).map((t) => t.purpose.trim()).filter(Boolean))], [trips]);

  if (!settings) return null;
  const dist = settings.distanceUnit;
  const s = parseDecimal(start);
  const e = parseDecimal(end);
  const distance = s != null && e != null ? e - s : null;

  const errors: Record<string, string> = {};
  if (!date) errors.date = 'Pick a date.';
  if (s == null) errors.start = 'Enter the starting reading.';
  if (e == null) errors.end = 'Enter the reading at the end.';
  else if (s != null && e < s) errors.end = 'The end reading must be at or above the start.';

  const check = readings && s != null ? checkOdometer(readings, date, s, editId ? { source: 'trip', id: editId } : undefined) : null;
  const low = check !== null && !check.ok;
  const show = (key: string) => submitted && errors[key] && <span className="error">{errors[key]}</span>;

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  function addTag() {
    const tag = newTag.trim();
    if (!tag) return;
    const existingTag = tagOptions.find((t) => t.toLowerCase() === tag.toLowerCase()) ?? tag;
    if (!tags.includes(existingTag)) setTags([...tags, existingTag]);
    setNewTag('');
  }

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setSubmitted(true);
    scrollToFirstProblem();
    if (Object.keys(errors).length > 0 || (low && !confirmLow) || !bikeId || saving) return;
    setSaving(true);
    try {
      const trip = { bikeId, date, startOdometer: s!, endOdometer: e!, purpose: purpose.trim(), tags, notes: notes.trim() };
      if (editId) await db.trips.update(editId, trip);
      else await db.trips.add(trip);
      navigate(BACK, { replace: true });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!editId || !window.confirm('Delete this trip? This cannot be undone.')) return;
    await db.trips.delete(editId);
    navigate(BACK, { replace: true });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormHeader title={editId ? 'Edit trip' : 'Add trip'} fallback={BACK} />

      <div className="card form">
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(ev) => setDate(ev.target.value)} />
          {show('date')}
        </label>
        <div className="field-row">
          <label className="field">
            <span>Start ({dist})</span>
            <input inputMode="numeric" value={start} onChange={(ev) => setStart(ev.target.value)} onFocus={(ev) => ev.currentTarget.select()} />
            {show('start')}
          </label>
          <label className="field">
            <span>End ({dist})</span>
            <input inputMode="numeric" value={end} onChange={(ev) => setEnd(ev.target.value)} placeholder={start} />
            {show('end')}
          </label>
        </div>
        {low && check?.previous && <OdometerWarning previous={check.previous} unit={dist} confirmed={confirmLow} onConfirm={setConfirmLow} />}
        <p className="distance-readout" aria-live="polite">
          {distance != null && distance >= 0 ? (
            <>
              <strong>{formatNumber(distance)}</strong> {dist}
            </>
          ) : (
            <span className="hint">Distance appears when both readings are in.</span>
          )}
        </p>
      </div>

      <div className="card form">
        <label className="field">
          <span>Purpose or route</span>
          <input list="purposes" value={purpose} onChange={(ev) => setPurpose(ev.target.value)} placeholder="e.g. Bengaluru to Coorg" autoComplete="off" />
          <datalist id="purposes">
            {purposes.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
        <div className="field">
          <span>Tags</span>
          <ChipPicker label="Tags" options={tagOptions.map((t) => ({ value: t, label: t }))} selected={tags} onToggle={toggleTag} />
        </div>
        <div className="field-row">
          <input
            value={newTag}
            onChange={(ev) => setNewTag(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter') {
                ev.preventDefault();
                addTag();
              }
            }}
            placeholder="New tag"
            aria-label="New tag"
          />
          <button type="button" className="btn" onClick={addTag} disabled={!newTag.trim()}>
            Add
          </button>
        </div>
        <label className="field">
          <span>Notes</span>
          <textarea rows={2} value={notes} onChange={(ev) => setNotes(ev.target.value)} />
        </label>
      </div>

      {editId && (
        <button type="button" className="btn btn-danger-plain" onClick={onDelete}>
          Delete trip
        </button>
      )}

      <div className="bottom-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {editId ? 'Save changes' : 'Save trip'}
        </button>
      </div>
    </form>
  );
}
