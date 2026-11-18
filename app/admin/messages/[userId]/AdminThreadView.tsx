"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { replyInDepartment, setThreadStatus, type DepartmentMessage, type DepartmentThread } from "@/actions/admin-departments";
import { WORKFLOW_LABELS, type WorkflowStatus } from "@/lib/message-meta";

/** One conversation in a department inbox: who sent what and when, the book (with a link to its review), the status, and the reply box. */
export function AdminThreadView({ thread, messages }: { thread: DepartmentThread; messages: DepartmentMessage[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await replyInDepartment(thread.counterpartId, thread.department, body);
      if (!res.ok) { setError(res.error ?? "Failed to send."); return; }
      setBody("");
      router.refresh();
    });
  }
  function status(s: WorkflowStatus) {
    setError(null);
    startTransition(async () => {
      const res = await setThreadStatus(thread.counterpartId, thread.department, s);
      if (!res.ok) { setError(res.error ?? "Failed."); return; }
      router.refresh();
    });
  }

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 13 }}>Status: <strong>{WORKFLOW_LABELS[thread.status]}</strong></span>
        {(["NEW", "IN_PROGRESS", "RESOLVED"] as WorkflowStatus[]).filter((s) => s !== thread.status).map((s) => (
          <button key={s} type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => status(s)}>Mark {WORKFLOW_LABELS[s]}</button>
        ))}
        <Link href={`/admin/messages?d=${thread.department}`} className="btn btn-ghost btn-small">Back To Inbox</Link>
      </div>
      <div className="map-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ alignSelf: m.fromStaff ? "flex-end" : "flex-start", maxWidth: "78%" }}>
            <div style={{ fontSize: 11.5, color: "var(--admin-text-faint)", marginBottom: 3, textAlign: m.fromStaff ? "right" : "left" }}>
              {m.senderName} · {new Date(m.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
              {m.automatic && <span className="age-pill" style={{ marginLeft: 6 }}>Automatic</span>}
            </div>
            <div style={{ background: m.fromStaff ? "var(--admin-accent-fill, #2F62CF)" : "var(--admin-panel-hover)", color: m.fromStaff ? "#fff" : "var(--admin-text)", borderRadius: 12, padding: "8px 14px" }}>
              {m.bookTitle && (
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid rgba(128,128,128,.35)" }}>
                  Book: {m.bookTitle} · SN {m.bookSn ?? "—"}
                  {m.bookId && <> · <Link href={`/admin/books/${m.bookId}/review`} style={{ color: "inherit", textDecoration: "underline" }}>Open Review</Link></>}
                </div>
              )}
              <div style={{ fontSize: 13.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.body}</div>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={send} style={{ display: "flex", gap: 8 }}>
        <input className="field" style={{ marginBottom: 0, flex: 1 }} type="text" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Reply: this also emails them…" />
        <button type="submit" className="btn btn-primary btn-small" disabled={isPending}>Send</button>
      </form>
      <p className="field-hint" style={{ marginTop: 6 }}>Sent to their Messages page and to their email address.</p>
      {error && <div className="field-hint" style={{ color: "var(--admin-danger)" }}>{error}</div>}
    </>
  );
}
