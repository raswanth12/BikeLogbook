import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon } from './Icons';

const ACTIONS = [
  { label: 'Fuel', to: '/fuel/new' },
  { label: 'Trip', to: '/trip/new' },
  { label: 'Service', to: '/service/new' },
  { label: 'Expense', to: '/expense/new' },
];

export default function QuickAdd() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      {open && (
        <div className="quick-actions" role="menu">
          {ACTIONS.map((a) => (
            <button
              key={a.label}
              type="button"
              role="menuitem"
              className="quick-action"
              onClick={() => navigate(a.to)}
            >
              <span>{a.label}</span>
            </button>
          ))}
        </div>
      )}
      <button type="button" className={open ? 'fab open' : 'fab'} aria-label={open ? 'Close' : 'Add'} aria-expanded={open} onClick={() => setOpen(!open)}>
        <PlusIcon />
      </button>
    </>
  );
}
