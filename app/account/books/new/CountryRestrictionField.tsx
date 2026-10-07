"use client";

import { useMemo, useState } from "react";
import { COUNTRIES } from "@/lib/countries";

/**
 * Searchable checklist of countries where a book may NOT be sold.
 * Controlled: `value` is a list of ISO-2 codes, `onChange` receives the
 * new list (in selection order, no duplicates).
 */
export function CountryRestrictionField({
  value,
  onChange,
  idPrefix = "f",
}: {
  value: string[];
  onChange: (iso2: string[]) => void;
  idPrefix?: string;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.iso2.toLowerCase() === q) : COUNTRIES),
    [q],
  );
  const nameOf = (iso: string) => COUNTRIES.find((c) => c.iso2 === iso)?.name ?? iso;

  function toggle(iso: string) {
    onChange(value.includes(iso) ? value.filter((v) => v !== iso) : [...value, iso]);
  }

  return (
    <div>
      <label className="field-label" htmlFor={`${idPrefix}-countryrestrict`}>Country restrictions</label>
      <p className="field-hint" style={{ margin: "0 0 8px" }}>
        Tick every country where this book may NOT be sold.
      </p>
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
          {value.map((iso) => (
            <button
              key={iso}
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => toggle(iso)}
              aria-label={`Remove ${nameOf(iso)}`}
            >
              {nameOf(iso)} ×
            </button>
          ))}
        </div>
      )}
      <input
        className="field"
        id={`${idPrefix}-countryrestrict`}
        type="search"
        placeholder="Search countries"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div
        role="group"
        aria-label="Countries where this book may not be sold"
        style={{ maxHeight: 220, overflowY: "auto", border: "1px solid var(--line)", borderRadius: 10, padding: "6px 12px", marginTop: 6 }}
      >
        {filtered.length === 0 ? (
          <div className="field-hint">No countries match &quot;{query}&quot;.</div>
        ) : (
          filtered.map((c) => (
            <label key={c.iso2} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 400, padding: "3px 0" }}>
              <input type="checkbox" checked={value.includes(c.iso2)} onChange={() => toggle(c.iso2)} />
              {c.name}
            </label>
          ))
        )}
      </div>
    </div>
  );
}
