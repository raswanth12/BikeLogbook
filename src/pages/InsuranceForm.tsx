import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ChipPicker from '../components/ChipPicker';
import FormHeader from '../components/FormHeader';
import { CameraIcon } from '../components/Icons';
import PhotoThumb from '../components/PhotoThumb';
import Toggle from '../components/Toggle';
import { db } from '../db';
import { useActiveBike, useSettings } from '../db/hooks';
import {
  INSURANCE_ADD_ONS,
  INSURANCE_COVER_LABELS,
  INSURERS,
  PREMIUM_FREQUENCY_LABELS,
  type InsuranceCover,
  type PremiumFrequency,
} from '../db/types';
import { currentPolicy, policyCost, renewalDates } from '../lib/calc/insurance';
import { formatMoney, parseDecimal, todayISO } from '../lib/format';
import { compressImage } from '../lib/photos';
import { addMonths } from '../lib/reminders/evaluate';
import { scrollToFirstProblem } from '../lib/scrollToProblem';

const BACK = '/insurance';
const COVERS = Object.entries(INSURANCE_COVER_LABELS).map(([value, label]) => ({ value: value as InsuranceCover, label }));
const FREQUENCIES = Object.entries(PREMIUM_FREQUENCY_LABELS).map(([value, label]) => ({ value: value as PremiumFrequency, label }));
const NCB = [0, 20, 25, 35, 45, 50];

/** A year of cover from `start`: the day before the same date next year. */
function oneYearFrom(start: string): string {
  const [y, m, d] = addMonths(start, 12).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

export default function InsuranceForm() {
  const params = useParams();
  const editId = params.id ? Number(params.id) : undefined;
  const navigate = useNavigate();
  const settings = useSettings();
  const bike = useActiveBike();
  const bikeId = settings?.activeBikeId;

  const existing = useLiveQuery(async () => {
    if (!editId) return null;
    const p = await db.insurancePolicies.get(editId);
    if (!p) return null;
    const [photo, rules] = await Promise.all([p.photoId != null ? db.photos.get(p.photoId) : undefined, db.reminderRules.filter((r) => r.linkedPolicyId === p.id).toArray()]);
    return { policy: p, photo, renewal: rules.find((r) => r.policyEvent !== 'premium'), premiumRule: rules.find((r) => r.policyEvent === 'premium') };
  }, [editId]);
  const policies = useLiveQuery(async () => (bikeId ? await db.insurancePolicies.where('bikeId').equals(bikeId).toArray() : undefined), [bikeId]);

  const [insurer, setInsurer] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [cover, setCover] = useState<InsuranceCover>('comprehensive');
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(oneYearFrom(todayISO()));
  const [premium, setPremium] = useState('');
  const [frequency, setFrequency] = useState<PremiumFrequency>('once');
  const [idv, setIdv] = useState('');
  const [ncb, setNcb] = useState<number | null>(null);
  const [addOns, setAddOns] = useState<string[]>([]);
  const [contact, setContact] = useState('');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [remind, setRemind] = useState(true);
  const [remindPayments, setRemindPayments] = useState(true);
  const [alertDays, setAlertDays] = useState(2);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || existing === undefined || !policies) return;
    if (editId) {
      if (!existing) {
        navigate(BACK, { replace: true });
        return;
      }
      const p = existing.policy;
      setInsurer(p.insurer);
      setPolicyNumber(p.policyNumber);
      setCover(p.cover);
      setStartDate(p.startDate);
      setEndDate(p.endDate);
      setPremium(String(p.premium));
      setFrequency(p.frequency);
      setIdv(p.idv != null ? String(p.idv) : '');
      setNcb(p.ncbPercent ?? null);
      setAddOns(p.addOns);
      setContact(p.contact);
      setNotes(p.notes);
      setPhoto(existing.photo?.blob ?? null);
      setRemind(!!existing.renewal);
      setRemindPayments(!!existing.premiumRule);
      setAlertDays(existing.renewal?.alertDays ?? existing.premiumRule?.alertDays ?? 2);
    } else {
      // Renewing is the common case: start from the latest policy, the day after it ends.
      const last = currentPolicy(policies, todayISO());
      if (last) {
        const next = renewalDates(last.endDate);
        setInsurer(last.insurer);
        setCover(last.cover);
        setFrequency(last.frequency);
        setAddOns(last.addOns);
        setContact(last.contact);
        setStartDate(next.startDate);
        setEndDate(next.endDate);
      }
    }
    initialized.current = true;
  }, [editId, existing, policies, navigate]);

  if (!settings || !bike) return null;
  const cur = settings.currencySymbol;
  const pr = parseDecimal(premium);
  const idvNum = idv.trim() ? parseDecimal(idv) : undefined;

  const errors: Record<string, string> = {};
  if (!insurer.trim()) errors.insurer = 'Which company insures it?';
  if (!startDate || !endDate) errors.dates = 'Set when the cover starts and ends.';
  else if (endDate < startDate) errors.dates = 'The end date is before the start date.';
  if (!pr) errors.premium = 'Enter the premium.';
  if (idvNum === null) errors.idv = 'IDV must be a number, or blank.';
  const show = (key: string) => submitted && errors[key] && <span className="error">{errors[key]}</span>;

  const cost = pr && startDate && endDate && endDate >= startDate ? policyCost({ startDate, endDate, premium: pr, frequency }) : null;

  function onStart(v: string) {
    setStartDate(v);
    if (v) setEndDate(oneYearFrom(v));
  }

  async function onPickPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhoto(await compressImage(file));
    setPhotoChanged(true);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    scrollToFirstProblem();
    if (Object.keys(errors).length || !bikeId || saving) return;
    setSaving(true);
    try {
      await db.transaction('rw', db.insurancePolicies, db.photos, db.reminderRules, async () => {
        let photoId = existing?.policy.photoId;
        if (photoChanged) {
          if (photoId != null) await db.photos.delete(photoId);
          photoId = photo ? await db.photos.add({ blob: photo, createdAt: Date.now() }) : undefined;
        }
        const policy = {
          bikeId,
          insurer: insurer.trim(),
          policyNumber: policyNumber.trim(),
          cover,
          startDate,
          endDate,
          premium: pr!,
          frequency,
          idv: idvNum ?? undefined,
          ncbPercent: ncb ?? undefined,
          addOns,
          contact: contact.trim(),
          photoId,
          notes: notes.trim(),
        };
        let id = editId;
        if (id) await db.insurancePolicies.update(id, policy);
        else id = await db.insurancePolicies.add(policy);

        // Up to two reminders per policy: renewal on its last day, and each premium payment.
        // Their dates follow the policy (see resolvePolicyRules), so they never go stale.
        const linked = await db.reminderRules.filter((r) => r.linkedPolicyId === id).toArray();
        const upsert = async (event: 'renewal' | 'premium', wanted: boolean, fields: { title: string; dueDate: string; repeatMonths?: number }) => {
          const rule = linked.find((r) => (r.policyEvent ?? 'renewal') === event);
          if (!wanted) {
            if (rule) await db.reminderRules.delete(rule.id);
            return;
          }
          const reminder = { bikeId, type: 'insurance' as const, linkedPolicyId: id, policyEvent: event, alertDays, active: true, ...fields };
          if (rule) await db.reminderRules.update(rule.id, reminder);
          else await db.reminderRules.add(reminder);
        };
        await upsert('renewal', remind, { title: `Insurance renewal (${policy.insurer})`, dueDate: endDate });
        await upsert('premium', remindPayments && frequency !== 'once', {
          title: `Insurance premium (${policy.insurer})`,
          dueDate: startDate,
          repeatMonths: frequency === 'monthly' ? 1 : 12,
        });
      });
      navigate(BACK, { replace: true });
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!editId || !existing || !window.confirm('Delete this policy and its reminders?')) return;
    await db.transaction('rw', db.insurancePolicies, db.photos, db.reminderRules, async () => {
      if (existing.policy.photoId != null) await db.photos.delete(existing.policy.photoId);
      await db.reminderRules.filter((r) => r.linkedPolicyId === editId).delete();
      await db.insurancePolicies.delete(editId);
    });
    navigate(BACK, { replace: true });
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      <FormHeader title={editId ? 'Edit policy' : 'Add policy'} fallback={BACK} />
      <p className="hint section-note">For {bike.name}.</p>

      <div className="card form">
        <label className="field">
          <span>Insurer</span>
          <input list="insurers" value={insurer} onChange={(e) => setInsurer(e.target.value)} placeholder="Pick or type" autoComplete="off" />
          <datalist id="insurers">
            {INSURERS.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          {show('insurer')}
        </label>
        <label className="field">
          <span>Policy number</span>
          <input value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} autoCapitalize="characters" />
        </label>
        <div className="field">
          <span>Cover</span>
          <ChipPicker label="Cover" options={COVERS} selected={[cover]} onToggle={setCover} />
        </div>
        <div className="field-row">
          <label className="field">
            <span>Starts</span>
            <input type="date" value={startDate} onChange={(e) => onStart(e.target.value)} />
          </label>
          <label className="field">
            <span>Ends</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </label>
        </div>
        {show('dates')}
      </div>

      <h2 className="section-title">Premium</h2>
      <div className="card form">
        <div className="field">
          <span>Paid</span>
          <ChipPicker label="How the premium is paid" options={FREQUENCIES} selected={[frequency]} onToggle={setFrequency} />
        </div>
        <label className="field">
          <span>
            {frequency === 'once' ? 'Premium' : frequency === 'yearly' ? 'Premium each year' : 'Premium each month'} ({cur})
          </span>
          <input inputMode="decimal" value={premium} onChange={(e) => setPremium(e.target.value)} placeholder="0" />
          {show('premium')}
        </label>
        {cost && (
          <p className="cost-readout">
            <strong>{formatMoney(cost.total, cur, 0)}</strong> over {cost.months} {cost.months === 1 ? 'month' : 'months'} ·{' '}
            {formatMoney(cost.perYear, cur, 0)} a year · {formatMoney(cost.perMonth, cur, 0)} a month
          </p>
        )}
        <div className="field-row">
          <label className="field">
            <span>IDV ({cur}, optional)</span>
            <input inputMode="decimal" value={idv} onChange={(e) => setIdv(e.target.value)} placeholder="Insured value" />
            {show('idv')}
          </label>
        </div>
        <div className="field">
          <span>No-claim bonus</span>
          <ChipPicker label="No-claim bonus" options={NCB.map((n) => ({ value: String(n), label: `${n}%` }))} selected={ncb != null ? [String(ncb)] : []} onToggle={(v) => setNcb(ncb === Number(v) ? null : Number(v))} />
        </div>
        <div className="field">
          <span>Add-ons</span>
          <ChipPicker label="Add-ons" options={INSURANCE_ADD_ONS.map((a) => ({ value: a, label: a }))} selected={addOns} onToggle={(a) => setAddOns((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]))} />
        </div>
      </div>

      <h2 className="section-title">More</h2>
      <div className="card form">
        <label className="field">
          <span>Agent or helpline</span>
          <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Name, phone or claim number" />
        </label>
        <label className="field">
          <span>Notes</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
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
          <CameraIcon /> {photo ? 'Replace policy photo' : 'Add policy photo'}
          <input type="file" accept="image/*" onChange={onPickPhoto} />
        </label>
      </div>

      <h2 className="section-title">Reminders</h2>
      <div className="card form">
        <Toggle label="Remind me to renew" hint={`Before the policy ends on ${endDate ? new Date(`${endDate}T00:00:00`).toLocaleDateString() : '…'}`} checked={remind} onChange={setRemind} />
        {frequency !== 'once' && (
          <Toggle label="Remind me before each payment" hint={frequency === 'monthly' ? 'Every month, moving on by itself' : 'Every year, moving on by itself'} checked={remindPayments} onChange={setRemindPayments} />
        )}
        <div className="field">
          <span>Alert me</span>
          <ChipPicker
            label="Alert me"
            options={[1, 2, 3, 7, 15].map((d) => ({ value: String(d), label: d === 1 ? '1 day before' : `${d} days before` }))}
            selected={[String(alertDays)]}
            onToggle={(v) => setAlertDays(Number(v))}
          />
          <span className="hint">Shows on the Dashboard from then. For a phone alert, add it to Calendar from Settings &gt; Reminders.</span>
        </div>
      </div>

      {editId && (
        <button type="button" className="btn btn-danger-plain" onClick={onDelete}>
          Delete policy
        </button>
      )}

      <div className="bottom-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {editId ? 'Save changes' : 'Save policy'}
        </button>
      </div>
    </form>
  );
}
