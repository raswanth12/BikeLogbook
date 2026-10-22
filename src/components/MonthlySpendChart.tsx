import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SpendSplit } from '../lib/calc/aggregates';
import { formatMoney } from '../lib/format';
import { SPEND_CATEGORIES } from './SpendSplitBar';

const monthName = (m: number, style: 'narrow' | 'short' | 'long') => new Date(2000, m - 1, 1).toLocaleDateString(undefined, { month: style });
const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });

export default function MonthlySpendChart({ months, currency }: { months: (SpendSplit & { month: number })[]; currency: string }) {
  const data = months.map((m) => ({ ...m, label: monthName(m.month, 'narrow') }));
  const yearTotal = months.reduce((s, m) => s + m.total, 0);
  if (yearTotal === 0) return <p className="hint">No spending this year.</p>;

  const busiest = months.reduce((a, b) => (b.total > a.total ? b : a));

  return (
    <>
      <div className="chart" role="img" aria-label={`Monthly spend. Highest in ${monthName(busiest.month, 'long')}: ${formatMoney(busiest.total, currency, 0)}.`}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="label" interval={0} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
            <YAxis tickFormatter={(v: number) => compact.format(v)} tickLine={false} axisLine={false} width={40} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
            <Tooltip
              cursor={{ fill: 'var(--grid)' }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const d = active && payload?.[0]?.payload;
                if (!d) return null;
                return (
                  <div className="chart-tooltip">
                    <strong>
                      {monthName(d.month, 'long')}: {formatMoney(d.total, currency, 0)}
                    </strong>
                    {SPEND_CATEGORIES.filter((c) => d[c.key] > 0).map((c) => (
                      <span key={c.key} className="tooltip-row">
                        <span className="swatch" style={{ background: c.color }} aria-hidden="true" />
                        {c.label} {formatMoney(d[c.key], currency, 0)}
                      </span>
                    ))}
                  </div>
                );
              }}
            />
            {/* A surface-coloured stroke leaves a thin gap between stacked segments */}
            {SPEND_CATEGORIES.map((c, i) => (
              <Bar key={c.key} dataKey={c.key} stackId="spend" fill={c.color} stroke="var(--surface)" strokeWidth={1} radius={i === SPEND_CATEGORIES.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="legend inline">
        {SPEND_CATEGORIES.map((c) => (
          <li key={c.key}>
            <span className="swatch" style={{ background: c.color }} aria-hidden="true" />
            <span className="legend-label">{c.label}</span>
          </li>
        ))}
      </ul>
      <details className="table-view">
        <summary>Show as table</summary>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              {SPEND_CATEGORIES.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.month}>
                <td>{monthName(m.month, 'short')}</td>
                {SPEND_CATEGORIES.map((c) => (
                  <td key={c.key}>{m[c.key] ? compact.format(m[c.key]) : '–'}</td>
                ))}
                <td>{compact.format(m.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
