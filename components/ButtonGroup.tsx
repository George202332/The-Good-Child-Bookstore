"use client";

/** A row of selectable buttons, matching the print-submission mockup's
 * exact button-group style for trim size / binding / color / quality /
 * paper / finish (bordered, highlighted when selected) — rather than a
 * dropdown, which is what the eBook form's simpler print section used
 * before this dedicated rebuild. */
export function ButtonGroup({
  options,
  value,
  onChange,
}: {
  options: { label: string; code: string }[];
  value: string;
  onChange: (code: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
      {options.map((o) => (
        <button
          key={o.code}
          type="button"
          onClick={() => onChange(o.code)}
          style={{
            padding: "10px 16px",
            borderRadius: 10,
            border: `2px solid ${value === o.code ? "var(--coral)" : "var(--line)"}`,
            background: "var(--paper)",
            color: "var(--ink)",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
