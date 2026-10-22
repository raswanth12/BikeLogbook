import type { OdometerReading } from '../lib/calc/odometer';
import { formatDate, formatNumber } from '../lib/format';

interface Props {
  previous: OdometerReading;
  unit: string;
  confirmed: boolean;
  onConfirm: (confirmed: boolean) => void;
}

/** Shown when a reading is lower than an earlier one: likely a typo, but it can be saved anyway. */
export default function OdometerWarning({ previous, unit, confirmed, onConfirm }: Props) {
  return (
    <div className="warning">
      <p>
        This is lower than {formatNumber(previous.odometer)} {unit}, recorded on {formatDate(previous.date)}.
      </p>
      <label className="check">
        <input type="checkbox" checked={confirmed} onChange={(e) => onConfirm(e.target.checked)} />
        <span>The reading is correct, save anyway</span>
      </label>
    </div>
  );
}
