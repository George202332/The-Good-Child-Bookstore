"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendAdminReply, type AdminMessageRow } from "@/actions/admin-messages";
import { SUPPORT_CATEGORIES } from "@/lib/support-categories";

function categoryLabel(category: string | null): string | null {
  if (!category) return null;
  return SUPPORT_CATEGORIES.find((c) => c.key === category)?.label ?? category;
}

/** Mirrors the author-side ThreadView (app/account/messages/[userId]) —
 * same bubble-conversation layout, styled for the dark admin theme.
 * Sending here calls sendAdminReply, which saves the reply as a real
 * Message to this person (so it shows up in their own account Messages
 * tab) and emails them directly at the same time. */
export function AdminThreadView({ counterpartId, initial }: { counterpartId: string; initial: AdminMessageRow[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await sendAdminReply(counterpartId, body);
      if (!res.ok) {
        setError(res.error ?? "Failed to send.");
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <>
      <div className="map-card" style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
        {initial.length === 0 ? (
          <div style={{ color: "var(--admin-text-faint)", fontSize: 13 }}>No messages yet.</div>
        ) : (
          initial.map((m) => (
            <div key={m.id} style={{ alignSelf: m.fromSupport ? "flex-end" : "flex-start", maxWidth: "75%" }}>
              {categoryLabel(m.category) && (
                <div style={{ marginBottom: 3, textAlign: m.fromSupport ? "right" : "left" }}>
                  <span className="age-pill">{categoryLabel(m.category)}</span>
                </div>
              )}
              <div
                style={{
                  background: m.fromSupport ? "var(--admin-accent)" : "var(--admin-panel-hover)",
                  color: m.fromSupport ? "#fff" : "var(--admin-text)",
                  borderRadius: 12,
                  padding: "8px 14px",
                }}
              >
                <div style={{ fontSize: 13.5 }}>{m.body}</div>
                <div style={{ fontSize: 10, opacity: 0.75, marginTop: 4 }}>
                  {new Date(m.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <form onSubmit={handleSend} style={{ display: "flex", gap: 8 }}>
        <input className="field" style={{ marginBottom: 0, flex: 1 }} type="text" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Reply — this also emails them directly…" />
        <button type="submit" className="btn btn-primary btn-small" disabled={isPending}>Send</button>
      </form>
      <p className="field-hint" style={{ marginTop: 6 }}>Sent both to their account&apos;s Messages tab and to their email address.</p>
      {error && <div className="field-hint" style={{ color: "var(--admin-danger)" }}>{error}</div>}
    </>
  );
}
