"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { decidePersonalMessage, updatePersonalMessageFee } from "@/actions/personal-message";

interface Row { recordId: string; orderId: string; bookTitle: string; text: string; style: string; status: string; reasons: string[]; decidedByName: string | null; decidedAt: string | null; decisionNote: string | null; createdAt: string }

export function PersonalMessagesClient({ held, history, fee, isAdmin }: { held: Row[]; history: Row[]; fee: number; isAdmin: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feeText, setFeeText] = useState(fee.toFixed(2));
  const [feeMsg, setFeeMsg] = useState<string | null>(null);

  async function decide(id: string, action: "approve" | "reject") {
    setBusy(id); setError(null);
    const r = await decidePersonalMessage(id, action, note[id] ?? "").catch(() => ({ ok: false, error: "Something went wrong." }));
    setBusy(null);
    if (!r.ok) { setError(r.error ?? "Something went wrong."); return; }
    router.refresh();
  }
  async function saveFee(e: React.FormEvent) {
    e.preventDefault(); setFeeMsg(null);
    const r = await updatePersonalMessageFee(Number(feeText)).catch(() => ({ ok: false, error: "Something went wrong." }));
    setFeeMsg(r.ok ? "Saved. New orders use this fee." : r.error ?? "Something went wrong.");
    if (r.ok) router.refresh();
  }

  return (
    <>
      {isAdmin && (
        <form onSubmit={saveFee} className="form-section" style={{ maxWidth: 520, marginBottom: 16 }}>
          <label className="field-label">Personal Message Fee ($ per personalised printed book, 0 for free)</label>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input className="field" type="number" step="0.01" min={0} max={20} value={feeText} onChange={(e) => setFeeText(e.target.value)} style={{ maxWidth: 140 }} />
            <button className="btn btn-primary btn-small" type="submit">Save Fee</button>
          </div>
          <p className="field-hint">Shown as its own line at checkout when above zero. It is company revenue (never an author royalty) and is included in what the Processing Fee is worked out on.</p>
          {feeMsg && <p style={{ fontSize: 13 }}>{feeMsg}</p>}
        </form>
      )}
      {error && <p role="alert" style={{ color: "var(--coral-deep)", fontSize: 13 }}>{error}</p>}
      <h3 style={{ fontSize: 16, margin: "8px 0" }}>Needs action: {held.length}</h3>
      {held.length === 0 && <p style={{ color: "var(--ink-soft)", fontSize: 13.5 }}>Nothing is waiting. Messages that pass the automatic check go straight to print.</p>}
      {held.map((r) => (
        <div key={r.recordId} className="form-section" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>Order {r.orderId.slice(0, 8).toUpperCase()} · {r.bookTitle} · {new Date(r.createdAt).toLocaleString()}</div>
          <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", margin: "8px 0", fontSize: 14.5 }}>&ldquo;{r.text}&rdquo;</p>
          <p style={{ fontSize: 12.5, color: "#6B4503", margin: "0 0 8px" }}>Held because: {r.reasons.join("; ") || "flagged"}</p>
          <input className="field" placeholder="Note (optional, shown to the buyer if rejected)" value={note[r.recordId] ?? ""} onChange={(e) => setNote({ ...note, [r.recordId]: e.target.value })} maxLength={300} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary btn-small" disabled={busy === r.recordId} onClick={() => decide(r.recordId, "approve")}>Approve</button>
            <button className="btn btn-ghost btn-small" disabled={busy === r.recordId} onClick={() => decide(r.recordId, "reject")}>Reject</button>
          </div>
        </div>
      ))}
      <h3 style={{ fontSize: 16, margin: "20px 0 8px" }}>Every Message On Record</h3>
      <div className="table-scroll" style={{ overflowX: "auto" }}>
        <table className="data-table">
          <thead><tr><th>Date</th><th>Order</th><th>Book</th><th>Message</th><th>Status</th><th>Decided By</th></tr></thead>
          <tbody>
            {history.map((r) => (
              <tr key={r.recordId}>
                <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                <td>{r.orderId.slice(0, 8).toUpperCase()}</td>
                <td>{r.bookTitle}</td>
                <td style={{ maxWidth: 320, overflowWrap: "anywhere" }}>{r.text}</td>
                <td>{r.status === "CLEAR" ? "Passed Check" : r.status === "APPROVED" ? "Approved" : "Rejected"}</td>
                <td>{r.decidedByName ?? "Automatic check"}{r.decisionNote ? ` — ${r.decisionNote}` : ""}</td>
              </tr>
            ))}
            {history.length === 0 && <tr><td colSpan={6}>No messages yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
