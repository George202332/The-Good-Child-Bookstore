"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePayoutSchedule, type PayoutScheduleInput } from "@/actions/site-settings";

/**
 * Admin settings for the payout calendar and withholding tax. The lock day and release day drive the payout-details
 * lock on every author and reader profile and the dates shown in their messages. Saved on its own button.
 */
export function PayoutScheduleSettings({ initial }: { initial: PayoutScheduleInput }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true); setError(null); setSaved(false);
    const res = await updatePayoutSchedule(v);
    setSaving(false);
    if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
    setSaved(true);
    router.refresh();
  }
  const num = (k: keyof PayoutScheduleInput) => (e: React.ChangeEvent<HTMLInputElement>) => setV((s) => ({ ...s, [k]: Number(e.target.value) }));

  return (
    <div>
      <h3 style={{ fontSize: 15, margin: "20px 0 10px" }}>Payout Schedule And Withholding Tax</h3>
      <p style={{ fontSize: 12.5, color: "var(--ink-faint)", marginBottom: 10 }}>
        Payout details are locked from the lock day until the payout is released on the release day, and unlock the day
        after. Messages to users always show the real dates from here. Bank Transfer (through Verto) is the only payout method.
      </p>
      <div className="form-grid-2">
        <div><label className="field-label">Lock Day (Day Of The Month)</label><input className="field" type="number" min={1} max={27} value={v.payoutLockDay} onChange={num("payoutLockDay")} /></div>
        <div><label className="field-label">Release Day (Day Of The Month)</label><input className="field" type="number" min={2} max={28} value={v.payoutReleaseDay} onChange={num("payoutReleaseDay")} /></div>
        <div><label className="field-label">Withholding Tax: Kenya (%)</label><input className="field" type="number" min={0} max={100} step="0.01" value={v.withholdingRateKenya} onChange={num("withholdingRateKenya")} /></div>
        <div><label className="field-label">Withholding Tax: Outside Kenya (%)</label><input className="field" type="number" min={0} max={100} step="0.01" value={v.withholdingRateOther} onChange={num("withholdingRateOther")} /></div>
      </div>
      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      {saved && <div className="field-hint" style={{ color: "#165236" }}>Saved. The payout schedule is updated.</div>}
      <button type="button" className="btn btn-primary btn-small" style={{ marginTop: 10 }} disabled={saving} onClick={save}>
        {saving ? "Saving…" : "Save Payout Schedule"}
      </button>
    </div>
  );
}
