import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../db';
import { useActiveBike } from '../db/hooks';
import { VEHICLE_KIND_LABELS } from '../db/types';
import { ChevronIcon } from './Icons';

/** The page title on the Dashboard: the vehicle's name, and a menu to switch or add one. */
export default function VehicleSwitcher() {
  const bike = useActiveBike();
  const vehicles = useLiveQuery(() => db.bikes.toArray(), []);
  const [open, setOpen] = useState(false);
  if (!bike || !vehicles) return <h1>Bike Logbook</h1>;

  async function choose(id: number) {
    await db.settings.update(1, { activeBikeId: id });
    setOpen(false);
  }

  return (
    <div className="switcher">
      <button type="button" className="switcher-button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(!open)}>
        <h1>{bike.name}</h1>
        <ChevronIcon />
      </button>
      {open && (
        <>
          <div className="scrim clear" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="switcher-menu" role="menu">
            {vehicles.map((v) => (
              <button key={v.id} type="button" role="menuitemradio" aria-checked={v.id === bike.id} className="switcher-item" onClick={() => choose(v.id)}>
                <span className="row-title">{v.name}</span>
                <span className="row-sub">{[VEHICLE_KIND_LABELS[v.kind ?? 'motorcycle'], v.registration].filter(Boolean).join(' · ')}</span>
              </button>
            ))}
            <Link to="/vehicle/new" className="switcher-item add" role="menuitem">
              + Add vehicle
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
