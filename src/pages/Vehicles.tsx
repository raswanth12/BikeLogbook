import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '../db';
import { useSettings } from '../db/hooks';
import { FUEL_KIND_LABELS, VEHICLE_KIND_LABELS } from '../db/types';

export default function Vehicles() {
  const navigate = useNavigate();
  const settings = useSettings();
  const vehicles = useLiveQuery(() => db.bikes.toArray(), []);
  if (!settings || !vehicles) return null;

  return (
    <>
      <header className="page-header">
        <button type="button" className="btn-link" onClick={() => navigate('/settings')}>
          Settings
        </button>
        <h1>Vehicles</h1>
      </header>
      <p className="hint section-note">Each vehicle keeps its own fuel, services, trips, expenses, insurance and reminders. Switch between them from the Dashboard.</p>
      <ul className="list">
        {vehicles.map((v) => (
          <li key={v.id}>
            <div className="list-row">
              <Link to={`/vehicle/${v.id}`} className="row-main">
                <span className="row-title">
                  {v.name}
                  {v.id === settings.activeBikeId && <span className="badge">In use</span>}
                </span>
                <span className="row-sub">
                  {[VEHICLE_KIND_LABELS[v.kind ?? 'motorcycle'], FUEL_KIND_LABELS[v.fuelKind ?? 'petrol'], [v.make, v.model].filter(Boolean).join(' '), v.registration].filter(Boolean).join(' · ')}
                </span>
              </Link>
              {v.id !== settings.activeBikeId && (
                <button type="button" className="btn small" onClick={() => db.settings.update(1, { activeBikeId: v.id })}>
                  Use
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <div className="bottom-actions">
        <Link to="/vehicle/new" className="btn btn-primary">
          Add vehicle
        </Link>
      </div>
    </>
  );
}
