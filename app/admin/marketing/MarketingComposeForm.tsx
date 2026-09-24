"use client";

import { useState } from "react";
import { sendMarketingBlast } from "@/actions/marketing";

export function MarketingComposeForm({ optInCount }: { optInCount: number }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function handleSend() {
    setSending(true);
    setError(null);
    setResult(null);
    const res = await sendMarketingBlast(subject, body);
    setSending(false);
    setConfirming(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setResult({ sent: res.sent ?? 0, failed: res.failed ?? 0 });
    setSubject("");
    setBody("");
  }

  return (
    <div className="map-card" style={{ padding: 24, maxWidth: 640 }}>
      <label className="field-label" htmlFor="mk-subject">Subject</label>
      <input className="field" id="mk-subject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />

      <label className="field-label" htmlFor="mk-body" style={{ marginTop: 10 }}>Message (HTML)</label>
      <textarea className="field" id="mk-body" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />

      {error && <p className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</p>}
      {result && (
        <p className="field-hint" style={{ color: "#1F6B48" }}>
          Sent to {result.sent} reader{result.sent === 1 ? "" : "s"}{result.failed > 0 ? ` (${result.failed} failed)` : ""}.
        </p>
      )}

      {confirming ? (
        <div style={{ marginTop: 10 }}>
          <p className="field-hint" style={{ marginBottom: 8 }}>
            Send to all {optInCount} opted-in reader{optInCount === 1 ? "" : "s"} now? This can&apos;t be undone.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setConfirming(false)} disabled={sending}>Cancel</button>
            <button type="button" className="btn btn-primary btn-small" onClick={handleSend} disabled={sending}>
              {sending ? "Sending…" : "Confirm send"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-primary btn-small"
          style={{ marginTop: 10 }}
          disabled={optInCount === 0 || !subject.trim() || !body.trim()}
          onClick={() => setConfirming(true)}
        >
          Send to {optInCount} opted-in reader{optInCount === 1 ? "" : "s"}
        </button>
      )}
    </div>
  );
}
