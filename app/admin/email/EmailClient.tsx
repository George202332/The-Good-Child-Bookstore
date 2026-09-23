"use client";

import { useEffect, useState } from "react";
import { listInboxMessages, readMessage, sendOrReplyEmail } from "@/actions/google-email";
import type { InboxMessageSummary, FullMessage } from "@/lib/google/gmail";

type InboxRow = InboxMessageSummary;
type Message = FullMessage;

function ReconnectPrompt({ message }: { message?: string }) {
  return (
    <div className="map-card" style={{ padding: 20, textAlign: "center" }}>
      <p style={{ marginBottom: 10 }}>{message ?? "Gmail access needs to be reconnected."}</p>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- real API route + external redirect to Google, not a Next.js page */}
      <a href="/api/integrations/google/auth" className="btn btn-primary btn-small">Reconnect Gmail</a>
    </div>
  );
}

export function EmailClient() {
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [needsReconnect, setNeedsReconnect] = useState<string | undefined>();
  const [selected, setSelected] = useState<Message | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(false);

  const [replyBody, setReplyBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState(false);

  const [composing, setComposing] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");

  async function loadInbox(pageToken?: string) {
    setLoading(true);
    const res = await listInboxMessages(pageToken);
    setLoading(false);
    if (!res.ok) {
      if (res.needsReconnect) setNeedsReconnect(res.error);
      return;
    }
    setRows((prev) => (pageToken ? [...prev, ...(res.data?.messages ?? [])] : res.data?.messages ?? []));
    setNextPageToken(res.data?.nextPageToken);
  }

  useEffect(() => {
    listInboxMessages().then((res) => {
      setLoading(false);
      if (!res.ok) {
        if (res.needsReconnect) setNeedsReconnect(res.error);
        return;
      }
      setRows(res.data?.messages ?? []);
      setNextPageToken(res.data?.nextPageToken);
    });
  }, []);

  async function openMessage(id: string) {
    setLoadingMessage(true);
    setSelected(null);
    setSendSuccess(false);
    setReplyBody("");
    const res = await readMessage(id);
    setLoadingMessage(false);
    if (!res.ok) {
      if (res.needsReconnect) setNeedsReconnect(res.error);
      return;
    }
    setSelected(res.data);
  }

  async function handleReply() {
    if (!selected || !replyBody.trim()) return;
    setSending(true);
    setSendError(null);
    const res = await sendOrReplyEmail({
      to: selected.from,
      subject: selected.subject.startsWith("Re:") ? selected.subject : `Re: ${selected.subject}`,
      bodyHtml: replyBody,
      inReplyToMessageId: selected.id,
      threadId: selected.threadId,
    });
    setSending(false);
    if (!res.ok) {
      setSendError(res.error ?? "Couldn't send.");
      return;
    }
    setSendSuccess(true);
    setReplyBody("");
  }

  async function handleCompose() {
    setSending(true);
    setSendError(null);
    const res = await sendOrReplyEmail({ to: composeTo, subject: composeSubject, bodyHtml: composeBody });
    setSending(false);
    if (!res.ok) {
      setSendError(res.error ?? "Couldn't send.");
      return;
    }
    setComposing(false);
    setComposeTo("");
    setComposeSubject("");
    setComposeBody("");
  }

  if (needsReconnect) return <ReconnectPrompt message={needsReconnect} />;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16, alignItems: "start" }}>
      <div className="map-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: 12, borderBottom: "1px solid var(--line)" }}>
          <button type="button" className="btn btn-primary btn-small" onClick={() => setComposing(true)}>Compose</button>
        </div>
        <div style={{ maxHeight: 560, overflowY: "auto" }}>
          {rows.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => openMessage(r.id)}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "10px 12px",
                borderBottom: "1px solid var(--line)", background: selected?.id === r.id ? "var(--cream)" : "transparent",
                fontWeight: r.isUnread ? 700 : 400,
              }}
            >
              <div style={{ fontSize: 13 }}>{r.from}</div>
              <div style={{ fontSize: 13 }}>{r.subject}</div>
              <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>{r.snippet}</div>
            </button>
          ))}
          {rows.length === 0 && !loading && <p style={{ padding: 16, fontSize: 13, color: "var(--ink-faint)" }}>No messages.</p>}
        </div>
        {nextPageToken && (
          <button type="button" className="btn btn-ghost btn-small" style={{ width: "100%" }} disabled={loading} onClick={() => loadInbox(nextPageToken)}>
            {loading ? "Loading…" : "Load more"}
          </button>
        )}
      </div>

      <div className="map-card" style={{ padding: 20, minHeight: 400 }}>
        {composing ? (
          <>
            <h3 style={{ fontSize: 15, marginBottom: 10 }}>New message</h3>
            <label className="field-label">To</label>
            <input className="field" type="email" value={composeTo} onChange={(e) => setComposeTo(e.target.value)} />
            <label className="field-label">Subject</label>
            <input className="field" type="text" value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} />
            <label className="field-label">Message</label>
            <textarea className="field" rows={10} value={composeBody} onChange={(e) => setComposeBody(e.target.value)} />
            {sendError && <p className="field-hint" style={{ color: "var(--coral-deep)" }}>{sendError}</p>}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" className="btn btn-primary btn-small" disabled={sending} onClick={handleCompose}>{sending ? "Sending…" : "Send"}</button>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setComposing(false)}>Cancel</button>
            </div>
          </>
        ) : loadingMessage ? (
          <p style={{ color: "var(--ink-faint)" }}>Loading…</p>
        ) : selected ? (
          <>
            <h3 style={{ fontSize: 16, marginBottom: 4 }}>{selected.subject}</h3>
            <p style={{ fontSize: 13, color: "var(--ink-faint)", marginBottom: 16 }}>
              From {selected.from} — {selected.date}
            </p>
            {selected.bodyHtml ? (
              <div dangerouslySetInnerHTML={{ __html: selected.bodyHtml }} />
            ) : (
              <p style={{ whiteSpace: "pre-wrap" }}>{selected.bodyText}</p>
            )}

            <hr style={{ margin: "20px 0" }} />
            <label className="field-label">Reply</label>
            <textarea className="field" rows={6} value={replyBody} onChange={(e) => setReplyBody(e.target.value)} />
            {sendError && <p className="field-hint" style={{ color: "var(--coral-deep)" }}>{sendError}</p>}
            {sendSuccess && <p className="field-hint" style={{ color: "#1F6B48" }}>Reply sent.</p>}
            <button type="button" className="btn btn-primary btn-small" style={{ marginTop: 8 }} disabled={sending || !replyBody.trim()} onClick={handleReply}>
              {sending ? "Sending…" : "Send reply"}
            </button>
          </>
        ) : (
          <p style={{ color: "var(--ink-faint)" }}>Select a message to read it.</p>
        )}
      </div>
    </div>
  );
}
