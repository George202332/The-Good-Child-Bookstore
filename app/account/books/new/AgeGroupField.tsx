"use client";

import { AGE_TIERS, AGE_TIER_LABELS, ageGroupProblem, parseAgeGroups, serializeAgeGroups, type AgeTier } from "@/lib/age-groups";

/**
 * Age group picker: tick one or more groups. Groups must sit next to each
 * other (6-8 with 9-12 is fine, 3-5 with 9-12 is not); a gap shows a clear
 * message and the form's submit buttons stay disabled until it is fixed.
 */
export function AgeGroupField({ value, onChange, id }: { value: string; onChange: (value: string) => void; id: string }) {
  const selected = parseAgeGroups(value);
  const problem = ageGroupProblem(value);

  function toggle(tier: AgeTier) {
    const next = selected.includes(tier) ? selected.filter((t) => t !== tier) : [...selected, tier];
    onChange(serializeAgeGroups(next));
  }

  return (
    <div>
      <label className="field-label" htmlFor={`${id}-${AGE_TIERS[0]}`}>Age group</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6 }} role="group" aria-label="Age group">
        {AGE_TIERS.map((t) => {
          const on = selected.includes(t);
          return (
            <label
              key={t}
              htmlFor={`${id}-${t}`}
              style={{
                display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, cursor: "pointer",
                padding: "7px 12px", minHeight: 36, borderRadius: 4, border: "1px solid var(--line)",
                background: on ? "var(--lavender)" : "var(--paper)",
              }}
            >
              <input id={`${id}-${t}`} type="checkbox" checked={on} onChange={() => toggle(t)} />
              {AGE_TIER_LABELS[t]}
            </label>
          );
        })}
      </div>
      {problem ? (
        <div className="checkout-error" role="alert" style={{ marginTop: 6 }}>{problem}</div>
      ) : (
        <div className="field-hint" style={{ margin: "0 0 12px" }}>Pick one group, or several that sit next to each other.</div>
      )}
    </div>
  );
}
