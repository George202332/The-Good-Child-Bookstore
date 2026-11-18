"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  findUserToMessage, getSupportRecipient, markConversationRead, saveDraft, sendDraft, sendMessage, updateDraft, deleteDraft,
  type InboxConversation, type SentMessageRow, type DraftMessageRow,
} from "@/actions/messages";
import { DEPARTMENTS, departmentOf, type DepartmentKey } from "@/lib/message-departments";

type SentRow = Omit<SentMessageRow, "createdAt"> & { createdAt: string };
type DraftRow = Omit<DraftMessageRow, "createdAt"> & { createdAt: string };
type Tab = "inbox" | "sent" | "drafts";

function initialsFor(name: string): string {
  return name.split(" ").filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

function tidyTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString() === d.toDateString();
  if (sameDay) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (yesterday) return "Yesterday";
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function DeptIcon({ name }: { name: string }) {
  const common = { width: 12, height: 12, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (name) {
    case "pen": return <svg {...common}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>;
    case "crown": return <svg {...common}><path d="M3 18h18M4 18 3 7l5 4 4-7 4 7 5-4-1 11" /></svg>;
    case "wallet": return <svg {...common}><path d="M3 7a2 2 0 0 1 2-2h13v4" /><path d="M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2Z" /><circle cx="16" cy="14.5" r="1" /></svg>;
    case "calc": return <svg {...common}><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M8 7h8M8 12h2M12 12h2M8 16h2M12 16h2" /></svg>;
    default: return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" /></svg>;
  }
}

function DeptBadge({ department }: { department: string | null }) {
  const d = departmentOf(department);
  if (!d) return null;
  return <span className="msg-badge" style={{ color: d.color, background: d.bg }}><DeptIcon name={d.icon} />{d.label}</span>;
}

function AutoTag() {
  return <span className="msg-auto">Automatic</span>;
}

export function MessagesApp({
  conversations, sent, drafts, initialCounterpartId,
}: { conversations: InboxConversation[]; sent: SentRow[]; drafts: DraftRow[]; initialCounterpartId: string | null }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("inbox");
  const [query, setQuery] = useState("");
  const firstFor = initialCounterpartId ? conversations.find((c) => c.counterpartId === initialCounterpartId) : undefined;
  const [selectedKey, setSelectedKey] = useState<string | null>(firstFor?.key ?? null);
  const [selectedSentId, setSelectedSentId] = useState<string | null>(null);
  const [mobileChat, setMobileChat] = useState(!!firstFor);
  const [composeOpen, setComposeOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<DraftRow | null>(null);
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const selected = conversations.find((c) => c.key === selectedKey) ?? null;
  const selectedSent = sent.find((m) => m.id === selectedSentId) ?? null;

  useEffect(() => {
    if (selected && selected.unread > 0) {
      markConversationRead(selected.counterpartId).then(() => router.refresh());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [selectedKey, selected?.messages.length]);

  const q = query.trim().toLowerCase();
  const filteredConversations = useMemo(
    () => conversations.filter((c) => !q || [c.name, c.subject ?? "", c.lastBody, departmentOf(c.department)?.label ?? ""].some((t) => t.toLowerCase().includes(q))),
    [conversations, q]
  );
  const filteredSent = sent.filter((m) => !q || m.recipientName.toLowerCase().includes(q) || m.body.toLowerCase().includes(q));
  const filteredDrafts = drafts.filter((m) => !q || m.recipientName.toLowerCase().includes(q) || m.body.toLowerCase().includes(q));
  const unreadTotal = conversations.reduce((a, c) => a + (c.unread > 0 ? 1 : 0), 0);

  function openConversation(key: string) {
    setSelectedKey(key); setSelectedSentId(null); setMobileChat(true); setReplyError(null); setReply("");
  }

  function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !reply.trim()) return;
    setReplyError(null);
    startTransition(async () => {
      const dept = selected.isTeam ? ((selected.department as DepartmentKey | null) ?? "OPERATIONS") : undefined;
      const res = await sendMessage(selected.counterpartId, reply, undefined, dept ? { department: dept, subject: selected.subject ?? undefined } : undefined);
      if (!res.ok) { setReplyError(res.error ?? "Could not send."); return; }
      setReply("");
      router.refresh();
    });
  }

  return (
    <div className={`msg-app${mobileChat ? " msg-show-chat" : ""}`}>
      {/* ---------- Left: list ---------- */}
      <aside className="msg-list-panel">
        <div className="msg-tabs" role="tablist" aria-label="Message folders">
          {(["inbox", "sent", "drafts"] as Tab[]).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={`msg-tab${tab === t ? " on" : ""}`} onClick={() => { setTab(t); setMobileChat(false); }}>
              {t === "inbox" ? "Inbox" : t === "sent" ? "Sent" : "Drafts"}
              {t === "inbox" && unreadTotal > 0 && <span className="msg-count">{unreadTotal}</span>}
              {t === "drafts" && drafts.length > 0 && <span className="msg-count soft">{drafts.length}</span>}
            </button>
          ))}
        </div>
        <div className="msg-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input type="search" placeholder="Search messages" aria-label="Search messages" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>

        <div className="msg-list">
          {tab === "inbox" && (filteredConversations.length === 0
            ? <div className="msg-empty-note">{conversations.length === 0 ? "No messages yet. Use the Compose button to write to our team." : "Nothing matches your search."}</div>
            : filteredConversations.map((c) => (
              <button key={c.key} type="button" className={`msg-row${c.unread > 0 ? " unread" : ""}${selectedKey === c.key ? " selected" : ""}`} onClick={() => openConversation(c.key)}>
                <span className="msg-avatar" aria-hidden>{initialsFor(c.name)}</span>
                <span className="msg-row-body">
                  <span className="msg-row-top"><span className="msg-row-name">{c.name}</span><span className="msg-time">{tidyTime(c.lastAt)}</span></span>
                  <span className="msg-row-meta"><DeptBadge department={c.department} />{c.automatic && <AutoTag />}</span>
                  {c.subject && <span className="msg-row-subject">{c.subject}</span>}
                  <span className="msg-row-preview">{c.lastBody}</span>
                </span>
                {c.unread > 0 && <span className="msg-dot" aria-label="Unread" />}
              </button>
            )))}

          {tab === "sent" && (filteredSent.length === 0
            ? <div className="msg-empty-note">{sent.length === 0 ? "Nothing sent yet." : "Nothing matches your search."}</div>
            : filteredSent.map((m) => (
              <button key={m.id} type="button" className={`msg-row${selectedSentId === m.id ? " selected" : ""}`} onClick={() => { setSelectedSentId(m.id); setSelectedKey(null); setMobileChat(true); }}>
                <span className="msg-avatar" aria-hidden>{initialsFor(m.recipientName)}</span>
                <span className="msg-row-body">
                  <span className="msg-row-top"><span className="msg-row-name">To {m.recipientName}</span><span className="msg-time">{tidyTime(m.createdAt)}</span></span>
                  <span className="msg-row-preview">{m.body}</span>
                  <span className="msg-row-meta"><span className="msg-read">{m.read ? "Read" : "Delivered"}</span></span>
                </span>
              </button>
            )))}

          {tab === "drafts" && (filteredDrafts.length === 0
            ? <div className="msg-empty-note">{drafts.length === 0 ? "No drafts." : "Nothing matches your search."}</div>
            : filteredDrafts.map((d) => (
              <div key={d.id} className="msg-row draft">
                <span className="msg-avatar" aria-hidden>{initialsFor(d.recipientName)}</span>
                <span className="msg-row-body">
                  <span className="msg-row-top"><span className="msg-row-name">To {d.recipientName}</span><span className="msg-time">{tidyTime(d.createdAt)}</span></span>
                  <span className="msg-row-preview">{d.body}</span>
                  <span className="msg-row-actions">
                    <button type="button" className="btn btn-ghost btn-small" onClick={() => { setEditingDraft(d); setComposeOpen(true); }}>Edit</button>
                    <button type="button" className="btn btn-ghost btn-small" disabled={pending} onClick={() => startTransition(async () => { const r = await sendDraft(d.id); if (r.ok) router.refresh(); })}>Send</button>
                    <button type="button" className="btn btn-ghost btn-small" disabled={pending} onClick={() => startTransition(async () => { const r = await deleteDraft(d.id); if (r.ok) router.refresh(); })}>Delete</button>
                  </span>
                </span>
              </div>
            )))}
        </div>
      </aside>

      {/* ---------- Right: conversation ---------- */}
      <section className="msg-chat-panel">
        {selected ? (
          <div className="msg-chat" key={selected.key}>
            <header className="msg-chat-head">
              <button type="button" className="msg-back" onClick={() => setMobileChat(false)} aria-label="Back to messages">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <span className="msg-avatar" aria-hidden>{initialsFor(selected.name)}</span>
              <span className="msg-chat-title">
                <strong>{selected.name}</strong>
                <span className="msg-row-meta"><DeptBadge department={selected.department} />{selected.subject && <span className="msg-subject-chip">{selected.subject}</span>}</span>
              </span>
            </header>
            <div className="msg-bubbles">
              {selected.messages.map((m) => (
                <div key={m.id} className={`msg-bubble-row ${m.fromMe ? "me" : "them"}`}>
                  <div className={`msg-bubble ${m.fromMe ? "me" : "them"}`}>
                    {(m.department || m.automatic) && <div className="msg-bubble-tags"><DeptBadge department={m.department} />{m.automatic && <AutoTag />}</div>}
                    {m.subject && <div className="msg-bubble-subject">{m.subject}</div>}
                    <div className="msg-bubble-text">{m.body}</div>
                    <div className="msg-bubble-time">{tidyTime(m.createdAt)}</div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <form className="msg-reply" onSubmit={sendReply}>
              <input className="field" type="text" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply…" aria-label="Reply" />
              <button type="submit" className="btn btn-primary btn-small" disabled={pending || !reply.trim()}>Send</button>
            </form>
            {replyError && <div className="field-hint msg-error">{replyError}</div>}
          </div>
        ) : selectedSent ? (
          <div className="msg-chat" key={selectedSent.id}>
            <header className="msg-chat-head">
              <button type="button" className="msg-back" onClick={() => setMobileChat(false)} aria-label="Back to messages">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
              </button>
              <span className="msg-avatar" aria-hidden>{initialsFor(selectedSent.recipientName)}</span>
              <span className="msg-chat-title"><strong>To {selectedSent.recipientName}</strong></span>
            </header>
            <div className="msg-bubbles">
              <div className="msg-bubble-row me"><div className="msg-bubble me"><div className="msg-bubble-text">{selectedSent.body}</div><div className="msg-bubble-time">{tidyTime(selectedSent.createdAt)} · {selectedSent.read ? "Read" : "Delivered"}</div></div></div>
            </div>
          </div>
        ) : (
          <div className="msg-placeholder">
            <svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden>
              <rect x="10" y="18" width="52" height="38" rx="12" fill="#EFE6F8" />
              <path d="M24 56v12l14-12" fill="#EFE6F8" />
              <rect x="34" y="34" width="52" height="36" rx="12" fill="#FAF6F0" stroke="#6B3FA0" strokeWidth="2" />
              <path d="M58 70v12l-14-12" fill="#FAF6F0" stroke="#6B3FA0" strokeWidth="2" strokeLinejoin="round" />
              <circle cx="48" cy="52" r="3" fill="#6B3FA0" /><circle cx="60" cy="52" r="3" fill="#6B3FA0" /><circle cx="72" cy="52" r="3" fill="#6B3FA0" />
            </svg>
            <h3>Select a conversation</h3>
            <p>Pick a message on the left to read it, or tap Compose to write to our team.</p>
          </div>
        )}
      </section>

      {/* ---------- Floating Compose + slide-in panel ---------- */}
      <button type="button" className="msg-fab" onClick={() => { setEditingDraft(null); setComposeOpen(true); }} aria-label="Compose a new message">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
        <span>Compose</span>
      </button>
      {composeOpen && (
        <ComposePanel
          draft={editingDraft}
          onClose={() => { setComposeOpen(false); setEditingDraft(null); }}
          onDone={() => { setComposeOpen(false); setEditingDraft(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function ComposePanel({ draft, onClose, onDone }: { draft: DraftRow | null; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<"team" | "person">(draft ? "person" : "team");
  const [department, setDepartment] = useState<DepartmentKey | "">("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState(draft?.body ?? "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; role: string }[]>([]);
  const [person, setPerson] = useState<{ id: string; name: string } | null>(draft ? { id: draft.recipientId, name: draft.recipientName } : null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function search(v: string) {
    setQuery(v);
    if (v.trim().length < 2) { setResults([]); return; }
    setResults(await findUserToMessage(v));
  }

  async function send() {
    setError(null);
    if (!body.trim()) { setError("Write a message first."); return; }
    setBusy(true);
    let res: { ok: boolean; error?: string };
    if (mode === "team") {
      if (!department) { setBusy(false); setError("Choose a department."); return; }
      if (!subject.trim()) { setBusy(false); setError("Add a subject."); return; }
      const support = await getSupportRecipient();
      if (!support) { setBusy(false); setError("Our team inbox is not set up yet."); return; }
      res = await sendMessage(support.id, body, undefined, { department, subject });
    } else {
      if (!person) { setBusy(false); setError("Choose who this message is for."); return; }
      if (draft) {
        const u = await updateDraft(draft.id, person.id, body);
        res = u.ok ? await sendDraft(draft.id) : u;
      } else res = await sendMessage(person.id, body);
    }
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
    onDone();
  }

  async function saveAsDraft() {
    setError(null);
    if (mode === "team") { setError("Drafts are for messages to a person. Pick \"A Person\" to save one."); return; }
    if (!person) { setError("Choose who this draft is for."); return; }
    if (!body.trim()) { setError("Write something first."); return; }
    setBusy(true);
    const res = draft ? await updateDraft(draft.id, person.id, body) : await saveDraft(person.id, body);
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
    onDone();
  }

  return (
    <div className="msg-compose-wrap" role="dialog" aria-modal="true" aria-label="Compose a new message">
      <button type="button" className="msg-compose-scrim" aria-label="Close" onClick={onClose} />
      <div className="msg-compose">
        <header><h3>{draft ? "Edit Draft" : "New Message"}</h3><button type="button" className="msg-x" onClick={onClose} aria-label="Close">×</button></header>
        {!draft && (
          <div className="msg-seg" role="tablist">
            <button type="button" role="tab" aria-selected={mode === "team"} className={mode === "team" ? "on" : ""} onClick={() => setMode("team")}>Our Team</button>
            <button type="button" role="tab" aria-selected={mode === "person"} className={mode === "person" ? "on" : ""} onClick={() => setMode("person")}>A Person</button>
          </div>
        )}
        {mode === "team" ? (
          <>
            <label className="field-label" htmlFor="msg-dept">Department</label>
            <select id="msg-dept" className="field" value={department} onChange={(e) => setDepartment(e.target.value as DepartmentKey)}>
              <option value="">Choose a department…</option>
              {DEPARTMENTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
            <label className="field-label" htmlFor="msg-subject">Subject</label>
            <input id="msg-subject" className="field" type="text" maxLength={140} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What is this about?" />
          </>
        ) : person ? (
          <div className="msg-person"><span className="msg-avatar" aria-hidden>{initialsFor(person.name)}</span><strong>{person.name}</strong>{!draft && <button type="button" className="btn btn-ghost btn-small" onClick={() => setPerson(null)}>Change</button>}</div>
        ) : (
          <>
            <label className="field-label" htmlFor="msg-to">To: search by name or email</label>
            <input id="msg-to" className="field" type="text" value={query} onChange={(e) => search(e.target.value)} placeholder="Start typing a name…" />
            {results.map((r) => (
              <button key={r.id} type="button" className="msg-row" onClick={() => { setPerson({ id: r.id, name: r.name }); setResults([]); setQuery(""); }}>
                <span className="msg-avatar" aria-hidden>{initialsFor(r.name)}</span><span className="msg-row-body"><span className="msg-row-name">{r.name}</span></span><span className="age-pill">{r.role}</span>
              </button>
            ))}
          </>
        )}
        <label className="field-label" htmlFor="msg-body">Message</label>
        <textarea id="msg-body" className="field" rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message…" />
        {error && <div className="field-hint msg-error">{error}</div>}
        <div className="msg-compose-actions">
          <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={send}>Send</button>
          {mode === "person" && <button type="button" className="btn btn-ghost btn-small" disabled={busy} onClick={saveAsDraft}>Save As Draft</button>}
          <button type="button" className="btn btn-ghost btn-small" disabled={busy} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
