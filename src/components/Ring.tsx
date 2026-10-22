import { useEffect, useState } from 'react';
import type { GaugeTone } from '../lib/calc/gauges';

interface Props {
  fill: number;
  tone: GaugeTone;
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  size?: number;
}

/** A WHOOP-style dial: a thick ring that sweeps to its value, with the number in the middle. */
export default function Ring({ fill, tone, label, value, unit, sub, size = 96 }: Props) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  // Start empty and sweep in once mounted (CSS skips the sweep when Reduce Motion is on).
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(fill));
    return () => cancelAnimationFrame(id);
  }, [fill]);

  return (
    <figure className={`ring tone-${tone}`} role="img" aria-label={`${label}: ${value}${unit ? ` ${unit}` : ''}${sub ? `. ${sub}` : ''}`}>
      <div className="ring-dial" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
          <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
          <circle
            className="ring-progress"
            cx={size / 2}
            cy={size / 2}
            r={r}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - Math.max(0.001, shown))}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </svg>
        <div className="ring-center">
          <span className="ring-value">{value}</span>
          {unit && <span className="ring-unit">{unit}</span>}
        </div>
      </div>
      <figcaption>
        <span className="ring-label">{label}</span>
        {sub && <span className="ring-sub">{sub}</span>}
      </figcaption>
    </figure>
  );
}
