import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronIcon } from '../components/Icons';
import ChipPicker from '../components/ChipPicker';
import Toggle from '../components/Toggle';
import { db } from '../db';
import { useSettings } from '../db/hooks';
import { SERVICE_CATEGORY_LABELS, VEHICLE_KIND_LABELS, type ServiceCategory, type ServiceItemType, type VehicleKind } from '../db/types';
import { CATEGORY_ORDER, groupByCategory, intervalText } from '../lib/catalog';
import { parseDecimal } from '../lib/format';

const ALL_KINDS = Object.keys(VEHICLE_KIND_LABELS) as VehicleKind[];

export default function ServiceCatalog() {
  const navigate = useNavigate();
  const settings = useSettings();
  const types = useLiveQuery(() => db.serviceItemTypes.orderBy('sortOrder').toArray(), []);
  const [editing, setEditing] = useState<number | 'new' | null>(null);

  if (!settings || !types) return null;
  const dist = settings.distanceUnit;

  // Swap places with the neighbour in the same category.
  async function move(item: ServiceItemType, direction: -1 | 1) {
    const group = types!.filter((t) => t.category === item.category).sort((a, b) => a.sortOrder - b.sortOrder);
    const other = group[group.indexOf(item) + direction];
    if (!other) return;
    await db.transaction('rw', db.serviceItemTypes, async () => {
      await db.serviceItemTypes.update(item.id, { sortOrder: other.sortOrder });
      await db.serviceItemTypes.update(other.id, { sortOrder: item.sortOrder });
    });
  }

  return (
    <>
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => navigate('/settings')}>
          Settings
        </button>
        <h1>Checklist</h1>
      </header>
      <p className="hint section-note">Intervals are a starting point: two-wheeler items are set for a Himalayan 450, car items for a typical car. Check them against your owner's manual. Hidden items stay in your history but leave the checklist.</p>

      {groupByCategory(types).map((group) => (
        <section key={group.category} className="checklist-group">
          <h3>{SERVICE_CATEGORY_LABELS[group.category]}</h3>
          <ul className="list">
            {group.items.map((t, i) => (
              <li key={t.id}>
                <div className={t.hidden ? 'list-row catalog-row hidden-item' : 'list-row catalog-row'}>
                  <button type="button" className="row-main catalog-name" onClick={() => setEditing(editing === t.id ? null : t.id)} aria-expanded={editing === t.id}>
                    <span className="row-title">
                      {t.name}
                      {t.hidden && <span className="badge">Hidden</span>}
                      {t.isCustom && <span className="badge">Custom</span>}
                      {t.kinds && <span className="badge">{t.kinds.map((k) => VEHICLE_KIND_LABELS[k]).join(', ')}</span>}
                    </span>
                    <span className="row-sub">{intervalText(t, dist) || 'No interval'}</span>
                  </button>
                  <div className="reorder">
                    <button type="button" className="icon-btn up" disabled={i === 0} onClick={() => move(t, -1)} aria-label={`Move ${t.name} up`}>
                      <ChevronIcon />
                    </button>
                    <button type="button" className="icon-btn" disabled={i === group.items.length - 1} onClick={() => move(t, 1)} aria-label={`Move ${t.name} down`}>
                      <ChevronIcon />
                    </button>
                  </div>
                </div>
                {editing === t.id && <ItemEditor item={t} distanceUnit={dist} onDone={() => setEditing(null)} />}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {editing === 'new' ? (
        <div className="list">
          <ItemEditor distanceUnit={dist} nextSortOrder={Math.max(0, ...types.map((t) => t.sortOrder)) + 1} onDone={() => setEditing(null)} />
        </div>
      ) : (
        <div className="bottom-actions">
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            Add item
          </button>
        </div>
      )}
    </>
  );
}

function ItemEditor({ item, distanceUnit, nextSortOrder, onDone }: { item?: ServiceItemType; distanceUnit: string; nextSortOrder?: number; onDone: () => void }) {
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState<ServiceCategory>(item?.category ?? 'general');
  const [km, setKm] = useState(item?.defaultIntervalKm?.toString() ?? '');
  const [months, setMonths] = useState(item?.defaultIntervalMonths?.toString() ?? '');
  const [hidden, setHidden] = useState(item?.hidden ?? false);
  const [kinds, setKinds] = useState<VehicleKind[]>(item?.kinds ?? ALL_KINDS);
  const [error, setError] = useState('');

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError('Give it a name.');
    if ((km && parseDecimal(km) == null) || (months && parseDecimal(months) == null)) return setError('Intervals must be numbers, or blank.');
    const patch = {
      name: n,
      category,
      defaultIntervalKm: parseDecimal(km) || undefined,
      defaultIntervalMonths: parseDecimal(months) || undefined,
      hidden,
      // Every type ticked is stored as "all", so new vehicle types pick the item up too.
      kinds: kinds.length === ALL_KINDS.length ? undefined : kinds,
    };
    if (item) await db.serviceItemTypes.update(item.id, patch);
    else await db.serviceItemTypes.add({ ...patch, isCustom: true, sortOrder: nextSortOrder ?? 0 });
    onDone();
  }

  return (
    <form className="form item-editor" onSubmit={onSave}>
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus={!item} />
      </label>
      <label className="field">
        <span>Category</span>
        <select value={category} onChange={(e) => setCategory(e.target.value as ServiceCategory)}>
          {CATEGORY_ORDER.map((c) => (
            <option key={c} value={c}>
              {SERVICE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </label>
      <div className="field-row">
        <label className="field">
          <span>Every ({distanceUnit})</span>
          <input inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} placeholder="—" />
        </label>
        <label className="field">
          <span>or every (months)</span>
          <input inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} placeholder="—" />
        </label>
      </div>
      <div className="field">
        <span>Shows for</span>
        <ChipPicker
          label="Vehicle types"
          options={ALL_KINDS.map((k) => ({ value: k, label: VEHICLE_KIND_LABELS[k] }))}
          selected={kinds}
          onToggle={(k) => setKinds((prev) => (prev.includes(k) ? (prev.length > 1 ? prev.filter((x) => x !== k) : prev) : [...prev, k]))}
        />
      </div>
      {item && <Toggle label="Hide from checklist" checked={hidden} onChange={setHidden} />}
      {error && <span className="error">{error}</span>}
      <div className="field-row">
        <button type="button" className="btn" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {item ? 'Save' : 'Add'}
        </button>
      </div>
    </form>
  );
}
