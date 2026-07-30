"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ComposeMessageForm, type ComposeInitial } from "./ComposeMessageForm";
import { sendDraft, deleteDraft, type ConversationRow, type SentMessageRow, type DraftMessageRow } from "@/actions/messages";

function initialsFor(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

type Tab = "inbox" | "sent" | "drafts";

export function MessagesTabs({
  conversations,
  sent,
  drafts,
}: {
  conversations: ConversationRow[];
  sent: SentMessageRow[];
  drafts: DraftMessageRow[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("inbox");
  const [composing, setComposing] = useState(false);
  const [editingDraft, setEditingDraft] = useState<ComposeInitial | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  function startCompose() {
    setEditingDraft(undefined);
    setComposing(true);
  }
  function editDraft(d: DraftMessageRow) {
    setEditingDraft({ draftId: d.id, recipientId: d.recipientId, recipientName: d.recipientName, body: d.body });
    setComposing(true);
  }
  function closeCompose() {
    setComposing(false);
    setEditingDraft(undefined);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className={`view-tab ${tab === "inbox" ? "active" : ""}`} onClick={() => setTab("inbox")}>
            Inbox{conversations.some((c) => c.unread) ? ` (${conversations.filter((c) => c.unread).length})` : ""}
          </button>
          <button type="button" className={`view-tab ${tab === "sent" ? "active" : ""}`} onClick={() => setTab("sent")}>
            Sent
          </button>
          <button type="button" className={`view-tab ${tab === "drafts" ? "active" : ""}`} onClick={() => setTab("drafts")}>
            Drafts{drafts.length > 0 ? ` (${drafts.length})` : ""}
          </button>
        </div>
        {!composing && (
          <button type="button" className="btn btn-primary btn-small" onClick={startCompose}>
            Compose
          </button>
        )}
      </div>

      {composing && <ComposeMessageForm initial={editingDraft} onDone={closeCompose} />}

      {!composing && tab === "inbox" && (
        conversations.length === 0 ? (
          <EmptyState label="No conversations yet" hint="Click Compose above to start your first conversation." />
        ) : (
          <div className="inbox-list">
            {conversations.map((c) => (
              <Link key={c.counterpartId} href={`/account/messages/${c.counterpartId}`} className={`inbox-row ${c.unread ? "inbox-row-unread" : ""}`}>
                <div className="inbox-avatar">{initialsFor(c.counterpartName)}</div>
                <div className="inbox-row-body">
                  <div className="inbox-row-top">
                    <span className="inbox-name">{c.counterpartName}</span>
                    <span className="inbox-date">{c.lastMessageAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </div>
                  <div className="inbox-preview">{c.lastMessage}</div>
                </div>
                {c.unread && <span className="inbox-unread-dot" aria-label="Unread" />}
              </Link>
            ))}
          </div>
        )
      )}

      {!composing && tab === "sent" && (
        sent.length === 0 ? (
          <EmptyState label="Nothing sent yet" hint="Messages you send will show up here." />
        ) : (
          <div className="inbox-list">
            {sent.map((m) => (
              <Link key={m.id} href={`/account/messages/${m.recipientId}`} className="inbox-row">
                <div className="inbox-avatar">{initialsFor(m.recipientName)}</div>
                <div className="inbox-row-body">
                  <div className="inbox-row-top">
                    <span className="inbox-name">To: {m.recipientName}</span>
                    <span className="inbox-date">{m.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </div>
                  <div className="inbox-preview">{m.body}</div>
                </div>
                <span className="age-pill">{m.read ? "Read" : "Unread"}</span>
              </Link>
            ))}
          </div>
        )
      )}

      {!composing && tab === "drafts" && (
        drafts.length === 0 ? (
          <EmptyState label="No drafts" hint="Start composing a message and choose Save as draft to keep it for later." />
        ) : (
          <div className="inbox-list">
            {drafts.map((d) => (
              <div key={d.id} className="inbox-row" style={{ cursor: "default" }}>
                <div className="inbox-avatar">{initialsFor(d.recipientName)}</div>
                <div className="inbox-row-body">
                  <div className="inbox-row-top">
                    <span className="inbox-name">To: {d.recipientName}</span>
                    <span className="inbox-date">{d.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </div>
                  <div className="inbox-preview">{d.body}</div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button type="button" className="btn btn-ghost btn-small" onClick={() => editDraft(d)}>Edit</button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    disabled={isPending}
                    onClick={() => startTransition(async () => { await sendDraft(d.id); router.refresh(); })}
                  >
                    Send
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    disabled={isPending}
                    onClick={() => startTransition(async () => { await deleteDraft(d.id); router.refresh(); })}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function EmptyState({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="map-card" style={{ padding: "48px 24px", textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--lavender)", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="var(--ink-soft)" strokeWidth={1.7}><path d="M4 6h16v12H4z" /><path d="M4 7l8 6 8-6" /></svg>
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{label}</div>
      <p style={{ color: "var(--ink-faint)", fontSize: 13 }}>{hint}</p>
    </div>
  );
}
