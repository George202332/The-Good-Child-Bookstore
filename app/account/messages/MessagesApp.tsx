"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  findUserToMessage, getSupportRecipient, markMessagesRead, saveDraft, sendDraft, sendMessage, updateDraft, deleteDraft,
  type InboxConversation, type SentMessageRow, type DraftMessageRow,
} from "@/actions/messages";
import { DEPARTMENTS, departmentOf, type DepartmentKey } from "@/lib/message-departments";
import type { BookRef } from "@/lib/book-reference";

const BOOK_DEPTS: string[] = ["EDITOR", "CHIEF_EDITOR"];

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

function DeptIcon({ name, size = 12 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
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

const BackArrow = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
);

export function MessagesApp({
  conversations, sent, drafts, initialCounterpartId, isAuthor, books,
}: { conversations: InboxConversation[]; sent: SentRow[]; drafts: DraftRow[]; initialCounterpartId: string | null; isAuthor: boolean; books: BookRef[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("inbox");
  const [query, setQuery] = useState("");
  const firstFor = initialCounterpartId ? conversations.find((c) => c.counterpartId === initialCounterpartId) : undefined;
  const [selectedKey, setSelectedKey] = useState<string | null>(firstFor?.key ?? null);
  const [selectedSentId, setSelectedSentId] = useState<string | null>(null);
  const [mobileChat, setMobileChat] = useState(!!firstFor);
  // The compose form opens INSIDE the right-hand panel; `draft` is set when an existing draft is being edited.
  const [composing, setComposing] = useState<{ draft: DraftRow | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const selected = conversations.find((c) => c.key === selectedKey) ?? null;
  const selectedSent = sent.find((m) => m.id === selectedSentId) ?? null;
  const selectedDept = departmentOf(selected?.department ?? null);

  useEffect(() => {
    if (selected && selected.unread > 0) {
      markMessagesRead(selected.messages.filter((m) => !m.fromMe).map((m) => m.id)).then(() => router.refresh());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKey]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ block: "end" }); }, [selectedKey, selected?.messages.length]);

  const q = query.trim().toLowerCase();
  const filteredConversations = useMemo(
    () => conversations.filter((c) => !q || [c.name, c.subject ?? "", c.lastBody, departmentOf(c.department)?.label ?? ""].some((t) => t.toLowerCase().includes(q))),
    [conversations, q]
  );
  const draftLabel = (d: DraftRow) => (d.department ? `${departmentOf(d.department)?.label ?? "Support"} Team` : d.recipientName);
  const filteredSent = sent.filter((m) => !q || m.recipientName.toLowerCase().includes(q) || m.body.toLowerCase().includes(q));
  const filteredDrafts = drafts.filter((m) => !q || draftLabel(m).toLowerCase().includes(q) || m.body.toLowerCase().includes(q) || (m.subject ?? "").toLowerCase().includes(q));
  const unreadTotal = conversations.reduce((a, c) => a + (c.unread > 0 ? 1 : 0), 0);

  function openConversation(key: string) {
    // Leaving the compose form (if open) saves a draft when something was typed: see ComposeInline.
    setComposing(null);
    setSelectedKey(key); setSelectedSentId(null); setMobileChat(true); setReplyError(null); setReply("");
  }
  function switchTab(t: Tab) { setComposing(null); setTab(t); setMobileChat(false); }
  function startCompose(draft: DraftRow | null) { setNotice(null); setComposing({ draft }); setMobileChat(true); }
  function leaveCompose() {
    // Back to the conversation that was open, or to the "Select a conversation" panel.
    setComposing(null);
    if (!selected && !selectedSent) setMobileChat(false);
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
    <div className="msg-shell">
      {/* ---------- One row: the three tabs, with Compose at the right-hand end ---------- */}
      <div className="msg-toolbar">
        <div className="msg-tabs" role="tablist" aria-label="Message folders">
          {(["inbox", "sent", "drafts"] as Tab[]).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className={`view-tab ${tab === t ? "active" : ""}`} onClick={() => switchTab(t)}>
              {t === "inbox" ? "Inbox" : t === "sent" ? "Sent" : "Drafts"}
              {t === "inbox" && unreadTotal > 0 && <span className="msg-count">{unreadTotal}</span>}
              {t === "drafts" && drafts.length > 0 && <span className="msg-count">{drafts.length}</span>}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-primary btn-small msg-compose-btn" onClick={() => startCompose(null)}>Compose</button>
      </div>
      {notice && <div className="msg-notice" role="status">{notice}</div>}

      <div className={`msg-app${mobileChat ? " msg-show-chat" : ""}${composing ? " msg-composing" : ""}`}>
        {/* ---------- Left: list ---------- */}
        <aside className="msg-list-panel">
          <div className="msg-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input type="search" placeholder="Search messages" aria-label="Search messages" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          <div className="msg-list">
            {tab === "inbox" && (filteredConversations.length === 0
              ? <div className="msg-empty-note">{conversations.length === 0 ? "No messages yet. Use Compose to write to our team." : "Nothing matches your search."}</div>
              : filteredConversations.map((c) => (
                <button key={c.key} type="button" className={`msg-row${c.unread > 0 ? " unread" : ""}${selectedKey === c.key && !composing ? " selected" : ""}`} onClick={() => openConversation(c.key)}>
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
                <button key={m.id} type="button" className={`msg-row${selectedSentId === m.id && !composing ? " selected" : ""}`} onClick={() => { setComposing(null); setSelectedSentId(m.id); setSelectedKey(null); setMobileChat(true); }}>
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
                  <span className="msg-avatar" aria-hidden>{initialsFor(draftLabel(d))}</span>
                  <span className="msg-row-body">
                    <span className="msg-row-top"><span className="msg-row-name">To {draftLabel(d)}</span><span className="msg-time">{tidyTime(d.createdAt)}</span></span>
                    {d.department && <span className="msg-row-meta"><DeptBadge department={d.department} /></span>}
                    {d.subject && <span className="msg-row-subject">{d.subject}</span>}
                    <span className="msg-row-preview">{d.body}</span>
                    <span className="msg-row-actions">
                      <button type="button" className="btn btn-ghost btn-small" onClick={() => startCompose(d)}>Edit</button>
                      <button type="button" className="btn btn-ghost btn-small" disabled={pending} onClick={() => startTransition(async () => { setDraftError(null); const r = await sendDraft(d.id); if (!r.ok) setDraftError(r.error ?? "Could not send."); else router.refresh(); })}>Send</button>
                      <button type="button" className="btn btn-ghost btn-small" disabled={pending} onClick={() => startTransition(async () => { const r = await deleteDraft(d.id); if (r.ok) router.refresh(); })}>Delete</button>
                    </span>
                  </span>
                </div>
              )))}
            {tab === "drafts" && draftError && <div className="field-hint msg-error">{draftError}</div>}
          </div>
        </aside>

        {/* ---------- Right: compose, conversation, or the friendly placeholder ---------- */}
        <section className="msg-chat-panel">
          {composing ? (
            <ComposeInline
              key={composing.draft?.id ?? "new"}
              draft={composing.draft}
              isAuthor={isAuthor}
              books={books}
              onLeave={leaveCompose}
              onSent={() => { setComposing(null); setTab("inbox"); setMobileChat(false); router.refresh(); }}
              onDraftSaved={() => { setNotice("Your draft was saved. You can find it under Drafts."); router.refresh(); }}
            />
          ) : selected ? (
            <div className="msg-chat" key={selected.key}>
              <header className="msg-chat-head">
                <button type="button" className="msg-back" onClick={() => setMobileChat(false)} aria-label="Back to messages"><BackArrow /></button>
                {selected.isTeam && selectedDept ? (
                  <span className="msg-chat-title">
                    <strong className="msg-dept-heading"><DeptIcon name={selectedDept.icon} size={16} />{selectedDept.label}</strong>
                    {selected.subject && <span className="msg-subject-line">{selected.subject}</span>}
                  </span>
                ) : (
                  <>
                    <span className="msg-avatar" aria-hidden>{initialsFor(selected.name)}</span>
                    <span className="msg-chat-title">
                      <strong>{selected.isTeam ? "Support Team" : selected.name}</strong>
                      {selected.subject && <span className="msg-subject-line">{selected.subject}</span>}
                    </span>
                  </>
                )}
              </header>
              <div className="msg-bubbles">
                {selected.messages.map((m) => (
                  <div key={m.id} className={`msg-bubble-row ${m.fromMe ? "me" : "them"}`}>
                    <div className={`msg-bubble ${m.fromMe ? "me" : "them"}`}>
                      {m.automatic && <div className="msg-bubble-tags"><AutoTag /></div>}
                      {m.bookTitle && <div className="msg-bubble-book">Book: {m.bookTitle} · SN {m.bookSn ?? "—"}</div>}
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
                <button type="button" className="msg-back" onClick={() => setMobileChat(false)} aria-label="Back to messages"><BackArrow /></button>
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
                <rect x="10" y="18" width="52" height="38" rx="12" fill="#CDBEEE" opacity="0.55" />
                <path d="M24 56v12l14-12" fill="#CDBEEE" opacity="0.55" />
                <rect x="34" y="34" width="52" height="36" rx="12" fill="#FCF6EA" stroke="#8C72D6" strokeWidth="2" />
                <path d="M58 70v12l-14-12" fill="#FCF6EA" stroke="#8C72D6" strokeWidth="2" strokeLinejoin="round" />
                <circle cx="48" cy="52" r="3" fill="#8C72D6" /><circle cx="60" cy="52" r="3" fill="#8C72D6" /><circle cx="72" cy="52" r="3" fill="#8C72D6" />
              </svg>
              <h3>Select a conversation</h3>
              <p>Pick a message on the left to read it, or tap Compose to write to our team.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/**
 * The compose form, shown inside the right-hand panel (never as a pop-out). Leaving it with text typed (Cancel, the back
 * arrow, opening another conversation or tab, or closing the page) saves a draft that appears under Drafts. Sending it
 * does not. Messages to our team need a department and a subject; messages to a person need a person.
 */
function ComposeInline({ draft, isAuthor, books, onLeave, onSent, onDraftSaved }: { draft: DraftRow | null; isAuthor: boolean; books: BookRef[]; onLeave: () => void; onSent: () => void; onDraftSaved: () => void }) {
  const [mode, setMode] = useState<"team" | "person">(draft && !draft.department ? "person" : "team");
  const [department, setDepartment] = useState<DepartmentKey | "">((draft?.department as DepartmentKey | null) ?? "");
  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [bookId, setBookId] = useState(draft?.bookId ?? "");
  const deptChoices = DEPARTMENTS.filter((d) => isAuthor || !BOOK_DEPTS.includes(d.key));
  const needsBook = mode === "team" && BOOK_DEPTS.includes(department);
  const [body, setBody] = useState(draft?.body ?? "");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; role: string }[]>([]);
  const [person, setPerson] = useState<{ id: string; name: string } | null>(draft && !draft.department ? { id: draft.recipientId, name: draft.recipientName } : null);
  const [supportId, setSupportId] = useState<string | null>(draft?.department ? draft.recipientId : null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Latest values for the "leave and save" paths, which run outside normal renders.
  const live = useRef({ mode, department, subject, bookId, body, person, supportId, draftId: draft?.id ?? null as string | null });
  useEffect(() => { live.current = { mode, department, subject, bookId, body, person, supportId, draftId: draft?.id ?? null }; });
  const draftIdRef = useRef<string | null>(draft?.id ?? null);
  const finished = useRef(false);
  const onDraftSavedRef = useRef(onDraftSaved);
  useEffect(() => { onDraftSavedRef.current = onDraftSaved; });

  useEffect(() => {
    if (supportId) return;
    let cancelled = false;
    getSupportRecipient().then((s) => { if (!cancelled && s) setSupportId(s.id); });
    return () => { cancelled = true; };
  }, [supportId]);

  async function persist(): Promise<boolean> {
    const v = live.current;
    if (!v.body.trim()) return false;
    const recipientId = v.mode === "team" ? v.supportId : v.person?.id ?? null;
    if (!recipientId) return false;
    const extra = v.mode === "team" && v.department ? { department: v.department, subject: v.subject, ...(v.bookId ? { bookId: v.bookId } : {}) } : undefined;
    const res: { ok: boolean; error?: string; draftId?: string } = draftIdRef.current
      ? await updateDraft(draftIdRef.current, recipientId, v.body, extra)
      : await saveDraft(recipientId, v.body, extra);
    if (res.ok && res.draftId) draftIdRef.current = res.draftId;
    if (res.ok) onDraftSavedRef.current();
    return res.ok;
  }

  // Leaving by any route (including opening another conversation, which removes this form) keeps what was typed.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === "hidden" && !finished.current && live.current.body.trim()) void persist(); };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      if (!finished.current && live.current.body.trim() && !(draft && live.current.body === draft.body && live.current.department === (draft.department ?? "") && live.current.subject === (draft.subject ?? ""))) void persist();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (BOOK_DEPTS.includes(department) && !bookId) { setBusy(false); setError("Choose the book this message is about."); return; }
      const sid = supportId ?? (await getSupportRecipient())?.id;
      if (!sid) { setBusy(false); setError("Our team inbox is not set up yet."); return; }
      if (draftIdRef.current) {
        const u = await updateDraft(draftIdRef.current, sid, body, { department, subject, bookId: bookId || undefined });
        res = u.ok ? await sendDraft(draftIdRef.current) : u;
      } else res = await sendMessage(sid, body, undefined, { department, subject, bookId: bookId || undefined });
    } else {
      if (!person) { setBusy(false); setError("Choose who this message is for."); return; }
      if (draftIdRef.current) {
        const u = await updateDraft(draftIdRef.current, person.id, body);
        res = u.ok ? await sendDraft(draftIdRef.current) : u;
      } else res = await sendMessage(person.id, body);
    }
    setBusy(false);
    if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
    finished.current = true;
    onSent();
  }

  function cancel() {
    // Closing the form unmounts it, and the unmount saves a draft if text was typed.
    onLeave();
  }

  return (
    <div className="msg-compose">
      <header className="msg-chat-head">
        <button type="button" className="msg-back" onClick={cancel} aria-label="Back"><BackArrow /></button>
        <span className="msg-chat-title"><strong>{draft ? "Edit Draft" : "New Message"}</strong><span className="msg-subject-line">Message our team, or write to another member.</span></span>
      </header>
      <div className="msg-compose-body">
        {!draft && (
          <div className="msg-tabs" role="tablist" aria-label="Who is this for">
            <button type="button" role="tab" aria-selected={mode === "team"} className={`view-tab ${mode === "team" ? "active" : ""}`} onClick={() => setMode("team")}>Our Team</button>
            <button type="button" role="tab" aria-selected={mode === "person"} className={`view-tab ${mode === "person" ? "active" : ""}`} onClick={() => setMode("person")}>A Person</button>
          </div>
        )}
        {mode === "team" ? (
          <>
            <label className="field-label" htmlFor="msg-dept">Department</label>
            <select id="msg-dept" className="field" value={department} onChange={(e) => setDepartment(e.target.value as DepartmentKey)}>
              <option value="">Choose a department…</option>
              {deptChoices.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
            {needsBook && (
              <>
                <label className="field-label" htmlFor="msg-book">Book</label>
                <select id="msg-book" className="field" value={bookId} onChange={(e) => setBookId(e.target.value)}>
                  <option value="">{books.length === 0 ? "You have no books yet" : "Choose one of your books…"}</option>
                  {books.map((b) => <option key={b.id} value={b.id}>{b.title} · SN {b.sn}</option>)}
                </select>
              </>
            )}
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
        <textarea id="msg-body" className="field" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message…" />
        {error && <div className="field-hint msg-error">{error}</div>}
        <div className="msg-compose-actions">
          <button type="button" className="btn btn-primary btn-small" disabled={busy || (needsBook && !bookId)} onClick={send}>Send</button>
          <button type="button" className="btn btn-ghost btn-small" disabled={busy} onClick={cancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
