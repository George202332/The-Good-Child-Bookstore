"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateCommissionRates } from "@/actions/commission-settings";
import type { CommissionRates } from "@/lib/commission-settings";

export function CommissionSettingsForm({ initial }: { initial: CommissionRates }) {
  const router = useRouter();
  const [referralPct, setReferralPct] = useState((initial.referralPct * 100).toString());
  const [promotionPct, setPromotionPct] = useState((initial.promotionPct * 100).toString());
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    const res = await updateCommissionRates({
      referralPct: Number(referralPct) / 100,
      promotionPct: Number(promotionPct) / 100,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="form-section" style={{ maxWidth: 480 }}>
      <label className="field-label" htmlFor="referral-pct">Referral commission (%)</label>
      <input
        className="field" id="referral-pct" type="number" min={0} max={100} step={0.1}
        value={referralPct} onChange={(e) => setReferralPct(e.target.value)}
      />
      <div className="field-hint">
        What an affiliate earns, for life, from the company&apos;s revenue on books sold by an author they referred
        onto the platform. Currently 5%.
      </div>

      <label className="field-label" htmlFor="promotion-pct" style={{ marginTop: 16 }}>Promotion commission (%)</label>
      <input
        className="field" id="promotion-pct" type="number" min={0} max={100} step={0.1}
        value={promotionPct} onChange={(e) => setPromotionPct(e.target.value)}
      />
      <div className="field-hint">
        What an affiliate earns per sale made through their own direct promotional link for a book. Currently 10%.
      </div>

      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      {saved && <div className="field-hint" style={{ color: "#1F6B48" }}>Saved — this applies to every new sale from now on.</div>}
      <button type="submit" className="btn btn-primary btn-small" style={{ marginTop: 16 }} disabled={submitting}>
        {submitting ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
