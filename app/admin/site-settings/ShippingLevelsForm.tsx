"use client";

import { useState, useTransition } from "react";
import { saveShippingLevels } from "@/actions/site-settings";
import { SHIPPING_LEVELS, normaliseEnabledLevels } from "@/lib/lulu-order";

/** The one setting left on this page: which shipping methods customers may choose for printed copies. Not a key. */
export function ShippingLevelsForm({ initial }: { initial: string[] }) {
  const [levels, setLevels] = useState<string[]>(normaliseEnabledLevels(initial));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveShippingLevels(levels);
          setMsg({ ok: r.ok, text: r.ok ? "Saved." : r.error ?? "Could not save." });
        });
      }}
    >
      <fieldset style={{ border: "none", padding: 0, margin: "0 0 12px" }}>
        <legend className="field-label">Shipping methods customers can choose for printed copies</legend>
        <p className="field-hint" style={{ margin: "0 0 8px" }}>
          The <strong>customer pays</strong> shipping: at checkout they see each method with its price (quoted live by Lulu for their
          address and copies) and the price is added to their total. Switch off any method you do not want to offer. Ground courier is
          only offered for the United States.
        </p>
        {SHIPPING_LEVELS.map((lvl) => (
          <label key={lvl.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 4 }}>
            <input
              type="checkbox"
              checked={levels.includes(lvl.id)}
              onChange={(e) => {
                const next = e.target.checked ? [...levels, lvl.id] : levels.filter((x) => x !== lvl.id);
                setLevels(next.length > 0 ? next : ["MAIL"]);
              }}
            />
            <span><strong>{lvl.label}</strong> — {lvl.detail}</span>
          </label>
        ))}
      </fieldset>
      <button type="submit" className="btn btn-primary btn-small" disabled={pending}>{pending ? "Saving..." : "Save shipping methods"}</button>
      {msg && <span role="status" style={{ marginLeft: 10, fontSize: 12.5, color: msg.ok ? "#2e8b57" : "#d64545" }}>{msg.text}</span>}
    </form>
  );
}
