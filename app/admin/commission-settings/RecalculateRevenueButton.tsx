"use client";

import { useState } from "react";
import { recalculateAllRevenueSplits } from "@/actions/admin-recalculate-revenue";

export function RecalculateRevenueButton() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; updated?: number; error?: string } | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function run() {
    setRunning(true);
    setResult(null);
    const res = await recalculateAllRevenueSplits();
    setRunning(false);
    setConfirming(false);
    setResult(res);
  }

  return (
    <div className="form-section" style={{ maxWidth: 640, marginTop: 20 }}>
      <h3 style={{ fontSize: 15, marginBottom: 4 }}>Recalculate historical transactions</h3>
      <p className="field-hint" style={{ marginBottom: 14 }}>
        Changing the percentages above only affects new sales — it doesn&apos;t change numbers already stored for
        past sales. Use this to recompute every existing sale&apos;s company/author/affiliate/referral split using
        the current percentages, so Revenue, Referrals, Analytics, and downloaded statements all reflect the current
        rates consistently. This only updates the recorded breakdown — it does not re-send or claw back any payout
        that&apos;s already gone out.
      </p>
      {!confirming ? (
        <button type="button" className="btn btn-ghost btn-small" onClick={() => setConfirming(true)}>
          Recalculate all transactions
        </button>
      ) : (
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>This rewrites every sale&apos;s stored breakdown. Continue?</span>
          <button type="button" className="btn btn-primary btn-small" disabled={running} onClick={run}>
            {running ? "Recalculating…" : "Yes, recalculate"}
          </button>
          <button type="button" className="btn btn-ghost btn-small" disabled={running} onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </div>
      )}
      {result && (
        <div className="field-hint" style={{ marginTop: 10, color: result.ok ? "#1F6B48" : "var(--coral-deep)" }}>
          {result.ok ? `Done — ${result.updated} sale line${result.updated === 1 ? "" : "s"} updated.` : result.error}
        </div>
      )}
    </div>
  );
}
