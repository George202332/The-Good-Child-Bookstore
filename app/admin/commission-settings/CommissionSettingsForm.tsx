"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCommissionRates } from "@/actions/commission-settings";
import type { CommissionRates, CommissionTier } from "@/lib/commission-settings";

export function CommissionSettingsForm({ initial }: { initial: CommissionRates }) {
  const router = useRouter();
  const [tiers, setTiers] = useState<CommissionTier[]>(initial.tiers);
  const [promotionPct, setPromotionPct] = useState((initial.promotionPct * 100).toString());
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function updateTier(i: number, field: keyof CommissionTier, value: string) {
    setTiers((prev) =>
      prev.map((t, idx) =>
        idx !== i
          ? t
          : {
              ...t,
              [field]:
                field === "name"
                  ? value
                  : field === "maxReferrals"
                    ? (value === "" ? null : Number(value))
                    : field === "pct"
                      ? Number(value) / 100
                      : Number(value),
            }
      )
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    const res = await updateCommissionRates({ promotionPct: Number(promotionPct) / 100, tiers });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="form-section" style={{ maxWidth: 640 }}>
      <h3 style={{ fontSize: 15, marginBottom: 4 }}>Referral Tiers</h3>
      <p className="field-hint" style={{ marginBottom: 14 }}>
        An affiliate&apos;s referral commission rate is based on how many authors they&apos;ve referred — the more
        they bring in, the higher their tier and rate.
      </p>
      {tiers.map((t, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr", gap: 10, marginBottom: 10, alignItems: "end" }}>
          <div>
            <label className="field-label">Tier name</label>
            <input className="field" type="text" value={t.name} onChange={(e) => updateTier(i, "name", e.target.value)} />
          </div>
          <div>
            <label className="field-label">Min referrals</label>
            <input className="field" type="number" min={0} value={t.minReferrals} onChange={(e) => updateTier(i, "minReferrals", e.target.value)} />
          </div>
          <div>
            <label className="field-label">Max referrals</label>
            <input className="field" type="number" min={0} placeholder="No limit" value={t.maxReferrals ?? ""} onChange={(e) => updateTier(i, "maxReferrals", e.target.value)} />
          </div>
          <div>
            <label className="field-label">Rate (%)</label>
            <input className="field" type="number" min={0} max={100} step={0.1} value={t.pct * 100} onChange={(e) => updateTier(i, "pct", e.target.value)} />
          </div>
        </div>
      ))}

      <label className="field-label" htmlFor="promotion-pct" style={{ marginTop: 16 }}>Promotion commission (%)</label>
      <input
        className="field" id="promotion-pct" type="number" min={0} max={100} step={0.1}
        value={promotionPct} onChange={(e) => setPromotionPct(e.target.value)}
      />
      <div className="field-hint">
        What an affiliate earns per sale made through their own direct promotional link for a book — flat,
        regardless of tier.
      </div>

      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      {saved && <div className="field-hint" style={{ color: "#1F6B48" }}>Saved — this applies to every new sale from now on.</div>}
      <button type="submit" className="btn btn-primary btn-small" style={{ marginTop: 16 }} disabled={submitting}>
        {submitting ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
