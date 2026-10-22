import type { SpendSplit } from '../lib/calc/aggregates';
import { formatMoney } from '../lib/format';

// Fixed order, so each category keeps its colour everywhere in the app.
export const SPEND_CATEGORIES = [
  { key: 'fuel', label: 'Fuel', color: 'var(--series-1)' },
  { key: 'service', label: 'Service', color: 'var(--series-2)' },
  { key: 'accessories', label: 'Accessories', color: 'var(--series-3)' },
  { key: 'other', label: 'Other', color: 'var(--series-4)' },
  { key: 'insurance', label: 'Insurance', color: 'var(--series-5)' },
] as const;

export default function SpendSplitBar({ split, currency }: { split: SpendSplit; currency: string }) {
  const parts = SPEND_CATEGORIES.map((c) => ({ ...c, value: split[c.key] }));
  const summary = parts.map((p) => `${p.label} ${formatMoney(p.value, currency, 0)}`).join(', ');

  return (
    <div className="spend-split">
      <div className="stack-bar" role="img" aria-label={`Spend split: ${summary}`}>
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <span key={p.key} style={{ flexGrow: p.value, background: p.color }} />
          ))}
      </div>
      <ul className="legend">
        {parts.map((p) => (
          <li key={p.key}>
            <span className="swatch" style={{ background: p.color }} aria-hidden="true" />
            <span className="legend-label">{p.label}</span>
            <span className="legend-value">{formatMoney(p.value, currency, 0)}</span>
            <span className="legend-pct">{split.total > 0 ? `${Math.round((p.value / split.total) * 100)}%` : '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
