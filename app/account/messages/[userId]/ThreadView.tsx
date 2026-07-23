"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendMessage, type MessageRow } from "@/actions/messages";

export function ThreadView({ counterpartId, initial }: { counterpartId: string; initial: MessageRow[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await sendMessage(counterpartId, body);
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
          <div style={{ color: "var(--ink-faint)", fontSize: 13 }}>No messages yet — say hello.</div>
        ) : (
          initial.map((m) => (
            <div
              key={m.id}
              style={{
                alignSelf: m.fromMe ? "flex-end" : "flex-start",
                background: m.fromMe ? "var(--coral)" : "var(--cream)",
                color: m.fromMe ? "#fff" : "var(--ink)",
                borderRadius: 12,
                padding: "8px 14px",
                maxWidth: "75%",
              }}
            >
              <div style={{ fontSize: 13.5 }}>{m.body}</div>
              <div style={{ fontSize: 10, opacity: 0.75, marginTop: 4 }}>
                {new Date(m.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </div>
            </div>
          ))
        )}
      </div>
      <form onSubmit={handleSend} style={{ display: "flex", gap: 8 }}>
        <input className="field" style={{ marginBottom: 0, flex: 1 }} type="text" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type a message…" />
        <button type="submit" className="btn btn-primary btn-small" disabled={isPending}>Send</button>
      </form>
      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
    </>
  );
}
