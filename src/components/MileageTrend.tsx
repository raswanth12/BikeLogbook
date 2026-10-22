import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDate, formatNumber } from '../lib/format';

export interface TrendPoint {
  date: string;
  kmPerLitre: number;
}

const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

export default function MileageTrend({ points, average, unit }: { points: TrendPoint[]; average: number | null; unit: string }) {
  const data = points.map((p, i) => ({ ...p, i, label: shortDate(p.date), value: Math.round(p.kmPerLitre * 10) / 10 }));
  const values = data.map((d) => d.value);
  const min = Math.floor(Math.min(...values) - 2);
  const max = Math.ceil(Math.max(...values) + 2);

  return (
    <>
      <div
        className="chart"
        role="img"
        aria-label={`Mileage over the last ${data.length} full-tank fills, from ${formatNumber(values[0], 1)} to ${formatNumber(values[values.length - 1], 1)} ${unit}`}
      >
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="i" tickFormatter={(i: number) => data[i]?.label ?? ''} tickLine={false} axisLine={false} tick={{ fill: 'var(--muted)', fontSize: 12 }} minTickGap={28} />
            <YAxis domain={[min, max]} allowDecimals={false} tickLine={false} axisLine={false} width={32} tick={{ fill: 'var(--muted)', fontSize: 12 }} />
            {average != null && <ReferenceLine y={average} stroke="var(--muted)" strokeDasharray="4 4" />}
            <Tooltip
              cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const d = active && payload?.[0]?.payload;
                if (!d) return null;
                return (
                  <div className="chart-tooltip">
                    <strong>
                      {formatNumber(d.value, 1)} {unit}
                    </strong>
                    <span>{formatDate(d.date)}</span>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--series-1)"
              strokeWidth={2}
              // Past 60 points the dots crowd into a solid band and slow the chart down; the line alone reads better.
              dot={data.length > 60 ? false : { r: 4, fill: 'var(--series-1)', stroke: 'var(--surface)', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: 'var(--series-1)', stroke: 'var(--surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {average != null && <p className="hint">Dashed line: your average, {formatNumber(average, 1)} {unit}.</p>}
      <details className="table-view">
        <summary>Show as table</summary>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>{unit}</th>
            </tr>
          </thead>
          <tbody>
            {[...data].reverse().map((d) => (
              <tr key={d.i}>
                <td>{formatDate(d.date)}</td>
                <td>{formatNumber(d.value, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
