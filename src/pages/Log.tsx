import type { ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PlusIcon } from '../components/Icons';
import ServiceHistory from '../components/ServiceHistory';
import AccessoryList from './AccessoryList';
import ExpenseList from './ExpenseList';
import FuelList from './FuelList';
import TripList from './TripList';

const SEGMENTS: { key: string; label: string; view: () => ReactNode }[] = [
  { key: 'fuel', label: 'Fuel', view: () => <FuelList /> },
  { key: 'trips', label: 'Trips', view: () => <TripList /> },
  {
    key: 'service',
    label: 'Service',
    view: () => (
      <>
        <ServiceHistory />
        <Link to="/service/new" className="fab" aria-label="New service">
          <PlusIcon />
        </Link>
      </>
    ),
  },
  { key: 'accessories', label: 'Accessories', view: () => <AccessoryList /> },
  { key: 'expenses', label: 'Expenses', view: () => <ExpenseList /> },
];

export default function Log() {
  const [params, setParams] = useSearchParams();
  const current = SEGMENTS.find((s) => s.key === params.get('tab')) ?? SEGMENTS[0];

  return (
    <>
      <header className="page-header">
        <h1>Log</h1>
      </header>
      <div className="segmented" role="tablist">
        {SEGMENTS.map((s) => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={s.key === current.key}
            className={s.key === current.key ? 'seg active' : 'seg'}
            onClick={() => setParams({ tab: s.key }, { replace: true })}
          >
            {s.label}
          </button>
        ))}
      </div>
      {/* Keyed so each list starts with fresh filters */}
      <div key={current.key}>{current.view()}</div>
    </>
  );
}
