"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePayoutMethodToggles } from "@/actions/site-settings";
import type { PayoutMethodToggles as Toggles } from "@/lib/payout-method-availability";

/**
 * Admin switches for which payout methods authors/affiliates may pick.
 * These control PAYOUT destinations only; they have nothing to do with
 * the customer checkout payment settings (Paystack, card badges). Both
 * default to OFF. Saved on their own button (updatePayoutMethodToggles),
 * so they are not part of the branding form's Save.
 */
export function PayoutMethodToggles({ initial }: { initial: Toggles }) {
  const router = useRouter();
  const [toggles, setToggles] = useState<Toggles>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const res = await updatePayoutMethodToggles(toggles);
    setSaving(false);
    if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
    setSaved(true);
    router.refresh();
  }

  return (
    <div>
      <h3 style={{ fontSize: 15, margin: "20px 0 10px" }}>Payout methods (authors &amp; affiliates)</h3>
      <p style={{ fontSize: 12.5, color: "var(--ink-faint)", marginBottom: 10 }}>
        Choose which methods authors and affiliates can select to receive payouts. Bank transfer is always available.
        These are separate from the customer checkout payment settings. When a method is off, users still see it but
        cannot select it, and any details they already saved are kept.
      </p>
      <label className="toggle-row" style={{ marginBottom: 8 }}>
        <span className="toggle-switch">
          <input type="checkbox" checked={toggles.paypalPayoutsEnabled} onChange={(e) => setToggles((t) => ({ ...t, paypalPayoutsEnabled: e.target.checked }))} />
          <span className="toggle-slider" />
        </span>
        <span style={{ fontSize: 13.5 }}>Allow PayPal as a payout method</span>
      </label>
      <label className="toggle-row" style={{ marginBottom: 8 }}>
        <span className="toggle-switch">
          <input type="checkbox" checked={toggles.mpesaPayoutsEnabled} onChange={(e) => setToggles((t) => ({ ...t, mpesaPayoutsEnabled: e.target.checked }))} />
          <span className="toggle-slider" />
        </span>
        <span style={{ fontSize: 13.5 }}>Allow M-Pesa as a payout method</span>
      </label>
      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      {saved && <div className="field-hint" style={{ color: "#165236" }}>Saved. Payout method availability updated.</div>}
      <button type="button" className="btn btn-primary btn-small" disabled={saving} onClick={save}>
        {saving ? "Saving…" : "Save payout method settings"}
      </button>
    </div>
  );
}
