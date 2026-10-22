import { Link, useSearchParams } from 'react-router-dom';
import LastChangedList from '../components/LastChangedList';
import ServiceHistory from '../components/ServiceHistory';

const VIEWS = [
  { key: 'history', label: 'History' },
  { key: 'parts', label: 'Last changed' },
];

export default function Service() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'parts' ? 'parts' : 'history';

  return (
    <>
      <header className="page-header">
        <h1>Service</h1>
      </header>
      <div className="segmented" role="tablist">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={view === v.key}
            className={view === v.key ? 'seg active' : 'seg'}
            onClick={() => setParams({ view: v.key }, { replace: true })}
          >
            {v.label}
          </button>
        ))}
      </div>
      {view === 'history' ? <ServiceHistory /> : <LastChangedList />}
      <div className="bottom-actions">
        <Link to="/service/new" className="btn btn-primary">
          New service
        </Link>
      </div>
    </>
  );
}
