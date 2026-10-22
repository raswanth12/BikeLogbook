interface Props {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}

/** A full-width row that toggles when tapped anywhere. */
export default function Toggle({ label, checked, onChange, hint }: Props) {
  return (
    <button type="button" role="switch" aria-checked={checked} className="toggle-row" onClick={() => onChange(!checked)}>
      <span className="toggle-text">
        <span>{label}</span>
        {hint && <span className="hint">{hint}</span>}
      </span>
      <span className={checked ? 'switch on' : 'switch'} aria-hidden="true">
        <span className="knob" />
      </span>
    </button>
  );
}
