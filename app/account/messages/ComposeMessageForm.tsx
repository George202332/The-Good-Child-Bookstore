"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { findUserToMessage, sendMessage, saveDraft, updateDraft } from "@/actions/messages";

function initialsFor(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

export interface ComposeInitial {
  draftId?: string;
  recipientId: string;
  recipientName: string;
  body: string;
}

/** The real "compose a new message" experience — search for a
 * recipient, write the body, then either send it right away or save it
 * as a genuine draft (persisted, not browser-only) to finish later.
 * Also used to resume editing an existing draft (see initial). */
export function ComposeMessageForm({ initial, onDone }: { initial?: ComposeInitial; onDone?: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; role: string }[]>([]);
  const [recipientId, setRecipientId] = useState(initial?.recipientId ?? "");
  const [recipientName, setRecipientName] = useState(initial?.recipientName ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSearch(value: string) {
    setQuery(value);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setResults(await findUserToMessage(value));
  }

  function pickRecipient(r: { id: string; name: string }) {
    setRecipientId(r.id);
    setRecipientName(r.name);
    setQuery("");
    setResults([]);
  }

  async function handleSend() {
    if (!recipientId) { setError("Choose who this message is for."); return; }
    if (!body.trim()) { setError("Write a message first."); return; }
    setSubmitting(true);
    setError(null);
    const res = await sendMessage(recipientId, body);
    setSubmitting(false);
    if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
    router.push(`/account/messages/${recipientId}`);
  }

  async function handleSaveDraft() {
    if (!recipientId) { setError("Choose who this draft is for."); return; }
    if (!body.trim()) { setError("Write something first."); return; }
    setSubmitting(true);
    setError(null);
    const res = initial?.draftId
      ? await updateDraft(initial.draftId, recipientId, body)
      : await saveDraft(recipientId, body);
    setSubmitting(false);
    if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
    router.refresh();
    onDone?.();
  }

  return (
    <div className="map-card" style={{ padding: 20, background: "var(--cream)", marginBottom: 20, position: "relative" }}>
      <h3 style={{ fontSize: 15, marginBottom: 14 }}>{initial ? "Edit draft" : "Compose a new message"}</h3>

      {recipientId ? (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div className="inbox-avatar">{initialsFor(recipientName)}</div>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{recipientName}</div>
          <button type="button" className="btn btn-ghost btn-small" onClick={() => { setRecipientId(""); setRecipientName(""); }}>
            Change
          </button>
        </div>
      ) : (
        <>
          <label className="field-label" htmlFor="compose-search">To: search by name or email</label>
          <input
            className="field"
            id="compose-search"
            type="text"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Start typing a name..."
          />
          {results.length > 0 && (
            <div className="inbox-list" style={{ marginTop: 8, marginBottom: 14 }}>
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="inbox-row"
                  style={{ width: "100%", textAlign: "left", cursor: "pointer" }}
                  onClick={() => pickRecipient(r)}
                >
                  <div className="inbox-avatar">{initialsFor(r.name)}</div>
                  <div className="inbox-row-body">
                    <div className="inbox-name">{r.name}</div>
                  </div>
                  <span className="age-pill">{r.role}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <label className="field-label" htmlFor="compose-body" style={{ marginTop: recipientId ? 0 : 14 }}>Message</label>
      <textarea
        className="field"
        id="compose-body"
        rows={5}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your message..."
      />

      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button type="button" className="btn btn-primary btn-small" disabled={submitting} onClick={handleSend}>
          Send
        </button>
        <button type="button" className="btn btn-ghost btn-small" disabled={submitting} onClick={handleSaveDraft}>
          Save as draft
        </button>
        {onDone && (
          <button type="button" className="btn btn-ghost btn-small" disabled={submitting} onClick={onDone}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
