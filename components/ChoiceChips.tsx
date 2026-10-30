"use client";

/**
 * One choice from a short list, shown as a row of chips that wraps onto the next line when it
 * runs out of room. Same near-rectangular look as every other option chip (see .choice-chip in
 * app/site.css). Real radio buttons underneath, so the keyboard and screen readers work.
 */
export function ChoiceChips({
  id, label, options, value, onChange, disabled, hint,
}: {
  id: string;
  label: string;
  options: readonly string[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <fieldset id={id} className="choice-fieldset" disabled={disabled}>
      <legend className="field-label">{label}</legend>
      <div className="choice-chips" role="radiogroup" aria-label={label}>
        {options.map((o, i) => {
          const on = value === o;
          return (
            <label key={o} className="choice-chip" data-on={on} data-disabled={disabled || undefined}>
              <input type="radio" name={id} value={o} checked={on} onChange={() => onChange(o)} id={`${id}-${i}`} />
              <span>{o}</span>
            </label>
          );
        })}
      </div>
      {hint && <div className="field-hint" style={{ marginTop: 0, marginBottom: 12 }}>{hint}</div>}
    </fieldset>
  );
}
