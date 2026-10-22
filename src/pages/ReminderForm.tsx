import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChipPicker from '../components/ChipPicker';
import FormHeader from '../components/FormHeader';
import Toggle from '../components/Toggle';
import { db } from '../db';
import { useActiveBike, useSettings } from '../db/hooks';
import { itemFitsVehicle } from '../db/seed';
import { useServiceData } from '../db/useServiceData';
import { REMINDER_TYPE_DEFAULTS, REMINDER_TYPE_LABELS, type ReminderType } from '../db/types';
import { latestOdometer } from '../lib/calc/odometer';
import { lastChanged } from '../lib/calc/service';
import { formatDate, formatNumber, parseDecimal, todayISO } from '../lib/format';
import { nextDueAfterService, SOON_DAYS, SOON_KM } from '../lib/reminders/evaluate';
import { scrollToFirstProblem } from '../lib/scrollToProblem';

const BACK = '/settings/reminders';
const TYPES = Object.entries(REMINDER_TYPE_LABELS).map(([value, label]) => ({ value: value as ReminderType, label }));
const ALERT_OPTIONS = [1, 2, 3, 7, 15, 30];
const str = (n: number | undefined) => (n != null ? String(n) : '');

export default function ReminderForm() {
  const params = useParams();
  const editId = params.id ? Number(params.id) : undefined;
  const navigate = useNavigate();
  const settings = useSettings();
  const bike = useActiveBike();
  const bikeId = settings?.activeBikeId;
  const service = useServiceData(bikeId);
  const existing = useLiveQuery(async () => (editId ? ((await db.reminderRules.get(editId)) ?? null) : null), [editId]);

  const [type, setType] = useState<ReminderType>('serviceItem');
  const [itemId, setItemId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [dueOdometer, setDueOdometer] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [repeatKm, setRepeatKm] = useState('');
  const [repeatMonths, setRepeatMonths] = useState('');
  const [active, setActive] = useState(true);
  const [alertDays, setAlertDays] = useState<number | null>(null);
  const [hint, setHint] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const initialized = useRef(false);
  // The title we filled in ourselves, so we only replace it while you haven't typed your own.
  const autoTitle = useRef('');

  useEffect(() => {
    if (initialized.current || existing === undefined) return;
    if (editId) {
      if (!existing) {
        navigate(BACK, { replace: true });
        return;
      }
      setType(existing.type);
      setItemId(existing.linkedItemTypeId ?? '');
      setTitle(existing.title);
      setDueOdometer(str(existing.dueOdometer));
      setDueDate(existing.dueDate ?? '');
      setRepeatKm(str(existing.repeatKm));
      setRepeatMonths(str(existing.repeatMonths));
      setActive(existing.active);
      setAlertDays(existing.alertDays ?? null);
    }
    initialized.current = true;
  }, [editId, existing, navigate]);

  if (!settings || !service) return null;
  const dist = settings.distanceUnit;
  const items = service.itemTypes.filter((t) => (!t.hidden && itemFitsVehicle(t, bike?.kind)) || t.id === itemId);

  function setAutoTitle(next: string) {
    if (!title.trim() || title === autoTitle.current) setTitle(next);
    autoTitle.current = next;
  }

  function chooseType(next: ReminderType) {
    setType(next);
    const d = REMINDER_TYPE_DEFAULTS[next];
    if (d) {
      setAutoTitle(d.title);
      if (d.repeatMonths && !repeatMonths) setRepeatMonths(String(d.repeatMonths));
    }
  }

  // Picking a checklist item fills in its interval and works out when it's next due.
  function chooseItem(id: number | '') {
    setItemId(id);
    const item = service!.itemTypes.find((t) => t.id === id);
    if (!item) return;
    setAutoTitle(item.name);
    setRepeatKm(str(item.defaultIntervalKm));
    setRepeatMonths(str(item.defaultIntervalMonths));

    const lc = lastChanged(service!.records, service!.items, null, todayISO()).get(item.id);
    const fromOdo = lc?.odometer ?? latestOdometer(service!.readings) ?? 0;
    const fromDate = lc?.date ?? todayISO();
    const next = nextDueAfterService({}, item, fromOdo, fromDate);
    setDueOdometer(str(next?.dueOdometer));
    setDueDate(next?.dueDate ?? '');
    setHint(
      next
        ? lc
          ? `Worked out from the last change on ${formatDate(lc.date)} at ${formatNumber(lc.odometer)} ${dist}.`
          : 'Never logged, so counted from today and your current reading.'
        : 'This item has no interval. Set a due point below.',
    );
  }

  const odo = dueOdometer.trim() ? parseDecimal(dueOdometer) : undefined;
  const rKm = repeatKm.trim() ? parseDecimal(repeatKm) : undefined;
  const rMonths = repeatMonths.trim() ? parseDecimal(repeatMonths) : undefined;

  const errors: Record<string, string> = {};
  if (!title.trim()) errors.title = 'Give it a name.';
  if (type === 'serviceItem' && itemId === '') errors.item = 'Pick the checklist item.';
  if (odo === null || rKm === null || rMonths === null) errors.numbers = 'Km and months must be numbers, or blank.';
  if (odo == null && !dueDate) errors.due = `Set a due ${dist} reading, a date, or both.`;
  const show = (key: string) => submitted && errors[key] && <span className="error">{errors[key]}</span>;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    scrollToFirstProblem();
    if (Object.keys(errors).length > 0 || !bikeId) return;
    const rule = {
      bikeId,
      title: title.trim(),
      type,
      linkedItemTypeId: type === 'serviceItem' && itemId !== '' ? itemId : undefined,
      dueOdometer: odo ?? undefined,
      dueDate: dueDate || undefined,
      repeatKm: rKm || undefined,
      repeatMonths: rMonths || undefined,
      alertDays: alertDays ?? undefined,
      active,
    };
    if (editId) await db.reminderRules.update(editId, rule);
    else await db.reminderRules.add(rule);
    navigate(BACK, { replace: true });
  }

  async function onDelete() {
    if (!editId || !window.confirm('Delete this reminder?')) return;
    await db.reminderRules.delete(editId);
    navigate(BACK, { replace: true });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormHeader title={editId ? 'Edit reminder' : 'Add reminder'} fallback={BACK} />

      <div className="card form">
        <div className="field">
          <span>For</span>
          <ChipPicker label="Reminder type" options={TYPES} selected={[type]} onToggle={chooseType} />
        </div>
        {type === 'serviceItem' && (
          <label className="field">
            <span>Checklist item</span>
            <select value={itemId} onChange={(e) => chooseItem(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Choose…</option>
              {items.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            {show('item')}
            {hint && <span className="hint">{hint}</span>}
          </label>
        )}
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} />
          {show('title')}
        </label>
      </div>

      <h2 className="section-title">Due</h2>
      <div className="card form">
        <div className="field-row">
          <label className="field">
            <span>At ({dist})</span>
            <input inputMode="numeric" value={dueOdometer} onChange={(e) => setDueOdometer(e.target.value)} placeholder="—" />
          </label>
          <label className="field">
            <span>On date</span>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        </div>
        <span className="hint">Whichever comes first.</span>
        {show('due')}
        <div className="field">
          <span>Alert me</span>
          <ChipPicker
            label="Alert me"
            options={ALERT_OPTIONS.map((d) => ({ value: String(d), label: d === 1 ? '1 day before' : `${d} days before` }))}
            selected={[String(alertDays ?? SOON_DAYS)]}
            onToggle={(v) => setAlertDays(Number(v))}
          />
          <span className="hint">For date reminders. Km reminders show up {SOON_KM} {dist} ahead.</span>
        </div>
      </div>

      <h2 className="section-title">Repeat</h2>
      <div className="card form">
        <div className="field-row">
          <label className="field">
            <span>Every ({dist})</span>
            <input inputMode="numeric" value={repeatKm} onChange={(e) => setRepeatKm(e.target.value)} placeholder="—" />
          </label>
          <label className="field">
            <span>Every (months)</span>
            <input inputMode="numeric" value={repeatMonths} onChange={(e) => setRepeatMonths(e.target.value)} placeholder="—" />
          </label>
        </div>
        <span className="hint">Used to reset the reminder after a service. Leave blank for a one-off.</span>
        {show('numbers')}
        {editId && <Toggle label="Active" hint="Paused reminders stay here but don't show as due" checked={active} onChange={setActive} />}
      </div>

      {editId && (
        <button type="button" className="btn btn-danger-plain" onClick={onDelete}>
          Delete reminder
        </button>
      )}

      <div className="bottom-actions">
        <button type="submit" className="btn btn-primary">
          {editId ? 'Save changes' : 'Save reminder'}
        </button>
      </div>
    </form>
  );
}
