interface Props<T extends string> {
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
  label: string;
}

/** A row of tap targets. Pass one selected value for single choice, several for tags. */
export default function ChipPicker<T extends string>({ options, selected, onToggle, label }: Props<T>) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={selected.includes(o.value)} className={selected.includes(o.value) ? 'chip active' : 'chip'} onClick={() => onToggle(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
