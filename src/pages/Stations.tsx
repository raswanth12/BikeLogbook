import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db';
import type { Station } from '../db/types';
import { brandShort, FUEL_BRANDS } from '../lib/fuelCatalog';

export default function Stations() {
  const navigate = useNavigate();
  const data = useLiveQuery(async () => {
    const [stations, fuel] = await Promise.all([db.stations.toArray(), db.fuelEntries.toArray()]);
    const uses = new Map<number, number>();
    for (const f of fuel) if (f.stationId != null) uses.set(f.stationId, (uses.get(f.stationId) ?? 0) + 1);
    return { stations: stations.sort((a, b) => a.name.localeCompare(b.name)), uses };
  }, []);
  const [editing, setEditing] = useState<number | 'new' | null>(null);

  if (!data) return null;

  return (
    <>
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => navigate('/settings')}>
          Settings
        </button>
        <h1>Stations</h1>
      </header>
      <p className="hint section-note">Stations you type when logging fuel are saved here automatically.</p>

      {data.stations.length === 0 && editing !== 'new' ? (
        <div className="empty">
          <p>No stations yet.</p>
        </div>
      ) : (
        <ul className="list">
          {data.stations.map((s) => {
            const n = data.uses.get(s.id) ?? 0;
            return (
              <li key={s.id}>
                <button type="button" className="list-row row-button" onClick={() => setEditing(editing === s.id ? null : s.id)} aria-expanded={editing === s.id}>
                  <span className="row-main">
                    <span className="row-title">{s.name}</span>
                    {(s.brand || s.area) && <span className="row-sub">{[brandShort(s.brand), s.area].filter(Boolean).join(' · ')}</span>}
                  </span>
                  <span className="row-side">
                    <span className="row-sub">
                      {n} {n === 1 ? 'fill' : 'fills'}
                    </span>
                  </span>
                </button>
                {editing === s.id && <StationEditor station={s} uses={n} others={data.stations} onDone={() => setEditing(null)} />}
              </li>
            );
          })}
          {editing === 'new' && (
            <li>
              <StationEditor uses={0} others={data.stations} onDone={() => setEditing(null)} />
            </li>
          )}
        </ul>
      )}

      {editing !== 'new' && (
        <div className="bottom-actions">
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            Add station
          </button>
        </div>
      )}
    </>
  );
}

function StationEditor({ station, uses, others, onDone }: { station?: Station; uses: number; others: Station[]; onDone: () => void }) {
  const [name, setName] = useState(station?.name ?? '');
  const [area, setArea] = useState(station?.area ?? '');
  const [brand, setBrand] = useState(station?.brand ?? '');
  const [error, setError] = useState('');

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError('Give it a name.');
    if (others.some((o) => o.id !== station?.id && o.name.toLowerCase() === n.toLowerCase())) return setError('There is already a station with that name.');
    const patch = { name: n, area: area.trim() || undefined, brand: brand || undefined };
    if (station) await db.stations.update(station.id, patch);
    else await db.stations.add(patch);
    onDone();
  }

  // Fills keep their litres and cost; they just lose the station name.
  async function onDelete() {
    if (!station) return;
    const message = uses ? `Delete ${station.name}? ${uses} ${uses === 1 ? 'fill-up keeps' : 'fill-ups keep'} their details but lose the station.` : `Delete ${station.name}?`;
    if (!window.confirm(message)) return;
    await db.transaction('rw', db.stations, db.fuelEntries, async () => {
      await db.fuelEntries.where('stationId').equals(station.id).modify({ stationId: undefined });
      await db.stations.delete(station.id);
    });
    onDone();
  }

  return (
    <form className="form item-editor" onSubmit={onSave}>
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus={!station} />
      </label>
      <label className="field">
        <span>Fuel company</span>
        <select value={brand} onChange={(e) => setBrand(e.target.value)}>
          <option value="">Not set</option>
          {FUEL_BRANDS.map((b) => (
            <option key={b.key} value={b.key}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Area or city (optional)</span>
        <input value={area} onChange={(e) => setArea(e.target.value)} />
      </label>
      {error && <span className="error">{error}</span>}
      <div className="field-row">
        <button type="button" className="btn" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary">
          {station ? 'Save' : 'Add'}
        </button>
      </div>
      {station && (
        <button type="button" className="btn btn-danger-plain" onClick={onDelete}>
          Delete station
        </button>
      )}
    </form>
  );
}
