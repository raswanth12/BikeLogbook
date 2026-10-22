import { useNavigate } from 'react-router-dom';

/** Cancel on the left, title beside it. Cancel goes back, or to `fallback` if there's no history. */
export default function FormHeader({ title, fallback }: { title: string; fallback: string }) {
  const navigate = useNavigate();
  return (
    <header className="page-header">
      <button type="button" className="btn-link" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate(fallback))}>
        Cancel
      </button>
      <h1>{title}</h1>
    </header>
  );
}
