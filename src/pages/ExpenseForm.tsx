import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChipPicker from '../components/ChipPicker';
import FormHeader from '../components/FormHeader';
import OdometerWarning from '../components/OdometerWarning';
import { db } from '../db';
import { useSettings } from '../db/hooks';
import { getOdometerReadings } from '../db/odometer';
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from '../db/types';
import { checkOdometer } from '../lib/calc/odometer';
import { parseDecimal, todayISO } from '../lib/format';
import { scrollToFirstProblem } from '../lib/scrollToProblem';

const BACK = '/log?tab=expenses';
const CATEGORIES = Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => ({ value: value as ExpenseCategory, label }));

export default function ExpenseForm() {
  const params = useParams();
  const editId = params.id ? Number(params.id) : undefined;
  const navigate = useNavigate();
  const settings = useSettings();
  const bikeId = settings?.activeBikeId;

  const existing = useLiveQuery(async () => (editId ? ((await db.expenses.get(editId)) ?? null) : null), [editId]);
  const readings = useLiveQuery(async () => (bikeId ? await getOdometerReadings(bikeId) : undefined), [bikeId]);

  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState<ExpenseCategory>('parking');
  const [amount, setAmount] = useState('');
  const [odometer, setOdometer] = useState('');
  const [notes, setNotes] = useState('');
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
      setDate(existing.date);
      setCategory(existing.category);
      setAmount(String(existing.amount));
      setOdometer(existing.odometer != null ? String(existing.odometer) : '');
      setNotes(existing.notes);
    }
    initialized.current = true;
  }, [editId, existing, navigate]);

  if (!settings) return null;
  const cur = settings.currencySymbol;
  const dist = settings.distanceUnit;
  const a = parseDecimal(amount);
  const odo = odometer.trim() ? parseDecimal(odometer) : undefined;

  const errors: Record<string, string> = {};
  if (!date) errors.date = 'Pick a date.';
  if (!a) errors.amount = 'Amount must be more than 0.';
  if (odo === null) errors.odometer = 'Enter a number, or leave it blank.';

  const check = readings && odo != null ? checkOdometer(readings, date, odo, editId ? { source: 'expense', id: editId } : undefined) : null;
  const low = check !== null && !check.ok;
  const show = (key: string) => submitted && errors[key] && <span className="error">{errors[key]}</span>;

  async function onSubmit(ev: FormEvent) {
    ev.preventDefault();
    setSubmitted(true);
    scrollToFirstProblem();
    if (Object.keys(errors).length > 0 || (low && !confirmLow) || !bikeId || saving) return;
    setSaving(true);
    try {
      const expense = { bikeId, date, category, amount: a!, odometer: odo ?? undefined, notes: notes.trim() };
      if (editId) await db.expenses.update(editId, expense);
      else await db.expenses.add(expense);
      navigate(BACK, { replace: true });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!editId || !window.confirm('Delete this expense? This cannot be undone.')) return;
    await db.expenses.delete(editId);
    navigate(BACK, { replace: true });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormHeader title={editId ? 'Edit expense' : 'Add expense'} fallback={BACK} />

      <div className="card form">
        <div className="field">
          <span>Category</span>
          <ChipPicker label="Category" options={CATEGORIES} selected={[category]} onToggle={setCategory} />
        </div>
        <div className="field-row">
          <label className="field">
            <span>Amount ({cur})</span>
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            {show('amount')}
          </label>
          <label className="field">
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            {show('date')}
          </label>
        </div>
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

      {editId && (
        <button type="button" className="btn btn-danger-plain" onClick={onDelete}>
          Delete expense
        </button>
      )}

      <div className="bottom-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {editId ? 'Save changes' : 'Save expense'}
        </button>
      </div>
    </form>
  );
}
