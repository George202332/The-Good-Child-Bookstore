"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProcessingFeeRates } from "@/actions/processing-fee-rates";
import { ROUTE_LABEL, type FeeRates, type FeeRoute } from "@/lib/processing-fee";

export function ProcessingFeeRatesForm({ initial }: { initial: FeeRates }) {
  const router = useRouter();
  const routes = Object.keys(ROUTE_LABEL) as FeeRoute[];
  const [pct, setPct] = useState<Record<FeeRoute, string>>(() => Object.fromEntries(routes.map((r) => [r, String(Math.round(initial[r].rate * 10000) / 100)])) as Record<FeeRoute, string>);
  const [fixed, setFixed] = useState<Record<FeeRoute, string>>(() => Object.fromEntries(routes.map((r) => [r, initial[r].fixed.toFixed(2)])) as Record<FeeRoute, string>);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setSaved(false);
    const next = Object.fromEntries(routes.map((r) => [r, { rate: Number(pct[r]) / 100, fixed: Number(fixed[r]) }])) as FeeRates;
    const res = await updateProcessingFeeRates(next);
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="form-section" style={{ maxWidth: 640 }}>
      {routes.map((r) => (
        <div key={r} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 10, marginBottom: 10, alignItems: "end" }}>
          <div style={{ fontWeight: 700, paddingBottom: 10 }}>{ROUTE_LABEL[r]}</div>
          <div>
            <label className="field-label">Percentage (%)</label>
            <input className="field" type="number" step="0.01" min={0} max={50} value={pct[r]} onChange={(e) => setPct({ ...pct, [r]: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Fixed fee per payment ($)</label>
            <input className="field" type="number" step="0.01" min={0} max={5} value={fixed[r]} onChange={(e) => setFixed({ ...fixed, [r]: e.target.value })} />
          </div>
        </div>
      ))}
      {error && <p style={{ color: "var(--coral-deep)", fontSize: 13 }}>{error}</p>}
      {saved && <p style={{ color: "#165236", fontSize: 13 }}>Saved. New orders use these rates.</p>}
      <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save Rates"}</button>
    </form>
  );
}
