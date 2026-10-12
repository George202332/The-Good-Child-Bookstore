"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resendPrintOrder, type PrintOrderRow } from "@/actions/print-orders";

/** Print orders that have not reached Lulu, each with a "Send to Lulu"
 * button. Shown only to Admins, and only when there is something to show. */
export function PrintOrdersPanel({ rows }: { rows: PrintOrderRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, { ok: boolean; text: string }>>({});

  if (rows.length === 0) return null;

  function send(id: string) {
    setBusyId(id);
    startTransition(async () => {
      const res = await resendPrintOrder(id);
      setMessages((m) => ({ ...m, [id]: { ok: res.ok, text: res.message } }));
      setBusyId(null);
      router.refresh();
    });
  }

  return (
    <div style={{ border: "1.5px solid var(--admin-danger, #8C2F16)", borderRadius: 12, padding: 16, marginBottom: 20, background: "#fff" }}>
      <h3 style={{ fontSize: 15, marginBottom: 4 }}>Print orders not yet at Lulu ({rows.length})</h3>
      <p style={{ fontSize: 12.5, color: "var(--admin-text-faint, #6B7385)", margin: "0 0 12px" }}>
        Paid paperback/hardcover orders that were never sent, failed, or got stuck. Sending an order creates its print
        job in the Lulu system selected in API Management. Test orders are marked — sending one to Production would
        really print and charge it.
      </p>
      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((r) => (
          <div key={r.id} style={{ borderTop: "1px solid var(--line, #E5E7EB)", paddingTop: 10, display: "flex", gap: 12, justifyContent: "space-between", flexWrap: "wrap" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                #{r.shortId} · {r.customer} {r.isTest && <span style={{ color: "var(--admin-danger, #8C2F16)" }}>· TEST ORDER</span>}
              </div>
              <div style={{ fontSize: 12.5 }}>{r.items}</div>
              <div style={{ fontSize: 12, color: "var(--admin-text-faint, #6B7385)" }}>
                {new Date(r.createdAt).toLocaleString("en-US")} · Status: {r.status}
              </div>
              {r.error && <div style={{ fontSize: 12, color: "var(--admin-danger, #8C2F16)", marginTop: 4, wordBreak: "break-word" }}>{r.error}</div>}
              {messages[r.id] && (
                <div style={{ fontSize: 12, marginTop: 4, fontWeight: 700, color: messages[r.id].ok ? "#165236" : "var(--admin-danger, #8C2F16)" }}>
                  {messages[r.id].text}
                </div>
              )}
            </div>
            <button type="button" className="btn btn-primary btn-small" style={{ alignSelf: "center" }} disabled={isPending} onClick={() => send(r.id)}>
              {busyId === r.id ? "Sending…" : "Send to Lulu"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
