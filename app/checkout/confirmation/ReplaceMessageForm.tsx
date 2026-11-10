"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PersonalMessagePanel } from "@/components/PersonalMessagePanel";
import { replaceMyPersonalMessage } from "@/actions/personal-message";

/** Shown only when a Personal Message was not accepted: the buyer writes a new one and the book goes on to print once it passes. */
export function ReplaceMessageForm({ orderId, accessKey, saleLineId, initialStyle }: { orderId: string; accessKey: string | null; saleLineId: string; initialStyle: string }) {
  const router = useRouter();
  const [value, setValue] = useState({ text: "", style: initialStyle });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send() {
    setBusy(true); setError(null);
    const r = await replaceMyPersonalMessage(orderId, accessKey, saleLineId, value.text, value.style).catch(() => ({ ok: false, error: "Something went wrong. Please try again." }));
    setBusy(false);
    if (!r.ok) { setError(r.error ?? "Something went wrong."); return; }
    router.refresh();
  }
  return (
    <div style={{ marginTop: 8 }}>
      <PersonalMessagePanel value={value} onChange={setValue} compact />
      {error && <div role="alert" className="field-hint" style={{ color: "#a1262a" }}>{error}</div>}
      <button type="button" className="btn btn-primary btn-small" style={{ marginTop: 8 }} disabled={busy || !value.text.trim()} onClick={send}>{busy ? "Sending…" : "Send New Message"}</button>
    </div>
  );
}
