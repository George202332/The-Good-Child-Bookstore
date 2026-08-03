"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { triggerIndexNow, type IndexNowLogRow } from "@/actions/seo-marketing";

export function IndexNowPanel({ log, keyFileUrl }: { log: IndexNowLogRow[]; keyFileUrl: string }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const res = await triggerIndexNow(url);
    setSubmitting(false);
    if (!res.ok) setMessage({ ok: false, text: res.error ?? "Failed." });
    else {
      setMessage({ ok: true, text: "Submitted." });
      setUrl("");
      router.refresh();
    }
  }

  return (
    <div className="map-card" style={{ padding: 20, marginBottom: 24 }}>
      <p className="field-hint" style={{ margin: "0 0 12px" }}>
        Book approvals and blog publishes already ping IndexNow automatically. Use this to manually notify Bing
        about any other URL that changed. Verification key file:{" "}
        <a href={keyFileUrl} target="_blank" rel="noreferrer">{keyFileUrl}</a>
      </p>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input className="field" style={{ margin: 0 }} type="text" placeholder="https://thegoodchildbookstore.com/book/..." value={url} onChange={(e) => setUrl(e.target.value)} />
        <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>{submitting ? "Sending…" : "Submit"}</button>
      </form>
      {message && <div className="field-hint" style={{ color: message.ok ? "#1F6B48" : "var(--coral-deep)", marginBottom: 12 }}>{message.text}</div>}

      {log.length > 0 && (
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-faint)", marginBottom: 6 }}>RECENT SUBMISSIONS</div>
          {log.slice(0, 10).map((l) => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--line)", fontSize: 12.5 }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 420 }}>{l.url}</span>
              <span style={{ color: l.ok ? "#1F6B48" : "var(--coral-deep)" }}>{l.ok ? "Accepted" : `Failed${l.statusCode ? ` (${l.statusCode})` : ""}`}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
