"use client";

import { useState, useTransition } from "react";
import {
  sendMailingListBlast,
  searchMailingRecipients,
  type MailingAudience,
  type MailingAudienceCounts,
  type RecipientSearchResult,
} from "@/actions/marketing";

const AUDIENCES: { key: MailingAudience; label: (counts: MailingAudienceCounts) => string; hint: string }[] = [
  {
    key: "READER_OPTIN",
    label: (c) => `Readers — opted in to marketing (${c.readerOptIn})`,
    hint: "Only readers who've turned on marketing emails in their own Settings. A working unsubscribe link is added automatically.",
  },
  {
    key: "AUTHOR",
    label: (c) => `All authors (${c.author})`,
    hint: "Every author account on the platform.",
  },
  {
    key: "AFFILIATE",
    label: (c) => `Active affiliates (${c.affiliate})`,
    hint: "Everyone with active affiliate access, whether they signed up as an affiliate or turned it on as a reader.",
  },
  {
    key: "SPECIFIC",
    label: () => "Specific recipients",
    hint: "Search by name or email and build your own list.",
  },
];

export function MailingListComposeForm({ counts }: { counts: MailingAudienceCounts }) {
  const [audience, setAudience] = useState<MailingAudience>("READER_OPTIN");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RecipientSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<RecipientSearchResult[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeAudience = AUDIENCES.find((a) => a.key === audience)!;
  const recipientCount = audience === "SPECIFIC" ? selected.length : audience === "READER_OPTIN" ? counts.readerOptIn : audience === "AUTHOR" ? counts.author : counts.affiliate;

  async function runSearch(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const res = await searchMailingRecipients(q);
    setSearching(false);
    setSearchResults(res.filter((r) => !selected.some((s) => s.id === r.id)));
  }

  function addRecipient(r: RecipientSearchResult) {
    setSelected((prev) => [...prev, r]);
    setSearchResults((prev) => prev.filter((x) => x.id !== r.id));
  }

  function removeRecipient(id: string) {
    setSelected((prev) => prev.filter((r) => r.id !== id));
  }

  function handleSend() {
    startTransition(async () => {
      const res = await sendMailingListBlast(audience, selected.map((s) => s.id), subject, body);
      setConfirming(false);
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      setResult({ sent: res.sent ?? 0, failed: res.failed ?? 0 });
      setError(null);
      setSubject("");
      setBody("");
      setSelected([]);
    });
  }

  const canSend = subject.trim() && body.trim() && recipientCount > 0;

  return (
    <div className="map-card" style={{ padding: 24, maxWidth: 680 }}>
      <label className="field-label">Send to</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 6 }}>
        {AUDIENCES.map((a) => (
          <button
            key={a.key}
            type="button"
            className={`btn btn-small ${audience === a.key ? "btn-primary" : "btn-ghost"}`}
            onClick={() => {
              setAudience(a.key);
              setResult(null);
              setError(null);
            }}
          >
            {a.label(counts)}
          </button>
        ))}
      </div>
      <p className="field-hint" style={{ marginBottom: 16 }}>{activeAudience.hint}</p>

      {audience === "SPECIFIC" && (
        <div style={{ marginBottom: 16 }}>
          <label className="field-label" htmlFor="mk-search">Search people to add</label>
          <input
            className="field"
            id="mk-search"
            type="text"
            placeholder="Search by name or email…"
            value={query}
            onChange={(e) => runSearch(e.target.value)}
          />
          {searching && <p className="field-hint">Searching…</p>}
          {searchResults.length > 0 && (
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, marginTop: 4, maxHeight: 180, overflowY: "auto" }}>
              {searchResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => addRecipient(r)}
                  style={{ display: "flex", width: "100%", justifyContent: "space-between", padding: "8px 12px", fontSize: 12.5, textAlign: "left", borderBottom: "1px solid var(--line)", background: "none", cursor: "pointer" }}
                >
                  <span>{r.name} <span style={{ color: "var(--ink-faint)" }}>({r.email})</span></span>
                  <span style={{ color: "var(--ink-faint)" }}>{r.role} · Add</span>
                </button>
              ))}
            </div>
          )}

          {selected.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {selected.map((r) => (
                <span
                  key={r.id}
                  className="age-pill"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  {r.name} ({r.email})
                  <button type="button" onClick={() => removeRecipient(r.id)} style={{ fontSize: 13, lineHeight: 1, background: "none", cursor: "pointer" }} aria-label={`Remove ${r.name}`}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <label className="field-label" htmlFor="mk-subject">Subject</label>
      <input className="field" id="mk-subject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />

      <label className="field-label" htmlFor="mk-body" style={{ marginTop: 10 }}>Message (HTML)</label>
      <textarea className="field" id="mk-body" rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
      <p className="field-hint">
        This is wrapped automatically in the site&apos;s branded email template — just write the message itself.
      </p>

      {error && <p className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</p>}
      {result && (
        <p className="field-hint" style={{ color: "#1F6B48" }}>
          Sent to {result.sent} recipient{result.sent === 1 ? "" : "s"}{result.failed > 0 ? ` (${result.failed} failed)` : ""}.
        </p>
      )}

      {confirming ? (
        <div style={{ marginTop: 10 }}>
          <p className="field-hint" style={{ marginBottom: 8 }}>
            Send to {recipientCount} recipient{recipientCount === 1 ? "" : "s"} now? This can&apos;t be undone.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setConfirming(false)} disabled={isPending}>Cancel</button>
            <button type="button" className="btn btn-primary btn-small" onClick={handleSend} disabled={isPending}>
              {isPending ? "Sending…" : "Confirm send"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-primary btn-small"
          style={{ marginTop: 10 }}
          disabled={!canSend}
          onClick={() => setConfirming(true)}
        >
          Send to {recipientCount} recipient{recipientCount === 1 ? "" : "s"}
        </button>
      )}
    </div>
  );
}
