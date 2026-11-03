"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateMinimumPayout } from "@/actions/minimum-payout";

/** The admin's Minimum Payout. Payouts below it cannot be released (the server refuses them too); balances below it carry
 * over and add up. Only the Admin can change it. */
export function MinimumPayoutSetting({ initial, canEdit }: { initial: number; canEdit: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(String(initial));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const res = await updateMinimumPayout(Number(value));
    setBusy(false);
    if (!res.ok) {
      setMessage({ ok: false, text: res.error ?? "Something went wrong." });
      return;
    }
    setValue(String(res.amount));
    setMessage({ ok: true, text: "Saved. It applies to every release from now on." });
    router.refresh();
  }

  return (
    <form onSubmit={save} className="map-card" style={{ padding: 14, marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div>
        <label className="field-label" htmlFor="minimum-payout">Minimum Payout ($)</label>
        <input
          id="minimum-payout" className="field" type="number" min={0.01} max={100000} step={0.01} inputMode="decimal"
          value={value} disabled={!canEdit || busy} onChange={(e) => setValue(e.target.value)} style={{ maxWidth: 160 }}
        />
      </div>
      {canEdit && <button type="submit" className="btn btn-ghost btn-small" disabled={busy}>{busy ? "Saving…" : "Save"}</button>}
      <p className="field-hint" style={{ flex: "1 1 280px", margin: 0 }}>
        Below this amount the release is disabled for that author or affiliate, and the server refuses it too. Smaller balances are never lost: they
        carry over and add up until they reach the minimum.
      </p>
      {message && <div className="field-hint" style={{ width: "100%", color: message.ok ? "#165236" : "var(--coral-deep)" }}>{message.text}</div>}
    </form>
  );
}
