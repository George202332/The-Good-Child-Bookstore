"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { requestPayout } from "@/actions/payouts";
import type { WiseRecipientRow } from "@/actions/wise-recipients";

/** Shared between the author Revenue page and affiliate Earnings page —
 * requests a payout of the current Available balance to a chosen Wise
 * recipient. */
export function RequestPayoutForm({ available, recipients }: { available: number; recipients: WiseRecipientRow[] }) {
  const router = useRouter();
  const [recipientId, setRecipientId] = useState(recipients.find((r) => r.isDefault)?.id ?? recipients[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (recipients.length === 0) {
    return (
      <div className="form-section" style={{ background: "var(--cream)" }}>
        <p style={{ fontSize: 13.5, marginBottom: 10 }}>
          Add a payout method (M-Pesa, bank transfer, etc.) before requesting a payout.
        </p>
        <Link href="/account/payout-settings" className="btn btn-primary btn-small">Add a payout method</Link>
      </div>
    );
  }

  async function handleRequest() {
    setSubmitting(true);
    setError(null);
    const res = await requestPayout(recipientId);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setDone(true);
    router.refresh();
  }

  return (
    <div className="form-section" style={{ background: "var(--cream)" }}>
      <label className="field-label" htmlFor="payout-recipient">Send to</label>
      <select className="field" id="payout-recipient" value={recipientId} onChange={(e) => setRecipientId(e.target.value)}>
        {recipients.map((r) => (
          <option key={r.id} value={r.id}>{r.type} — {r.accountHolderName} ({r.currency})</option>
        ))}
      </select>
      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      {done && <div className="field-hint" style={{ color: "#1F6B48" }}>Payout requested — sent via Wise once approved.</div>}
      <button type="button" className="btn btn-primary btn-small" disabled={available <= 0 || submitting} onClick={handleRequest}>
        {submitting ? "Requesting…" : `Request payout of $${available.toFixed(2)}`}
      </button>
    </div>
  );
}
