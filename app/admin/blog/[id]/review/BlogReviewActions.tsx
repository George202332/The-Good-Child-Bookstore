"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveBlog, rejectBlog, suspendBlog, withdrawBlog } from "@/actions/blog";

type Tab = "attention" | "suspend" | "withdraw" | null;

/**
 * Approve / Attention / Suspend / Withdraw — the same design and
 * interaction pattern as Book Management's review popup (see
 * app/admin/books/[id]/review/ReviewActions.tsx): one row of buttons,
 * always visible together, not a form that replaces them. Clicking
 * Attention, Suspend, or Withdraw opens a message-box card below;
 * nothing happens until Send is clicked. Approve takes effect
 * immediately, no message needed. Unlike the Book version, every action
 * here finalizes immediately for either an Admin or Editor — Blog has
 * no Editor-proposes/Admin-ratifies tier to match Book's Suspend/
 * Withdraw with.
 */
export function BlogReviewActions({ blogId }: { blogId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<Tab>(null);
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error ?? "Failed");
      else {
        setActiveTab(null);
        setComments("");
        router.refresh();
      }
    });
  }

  function handleSend() {
    if (!comments.trim()) { setError("Write a message first."); return; }
    if (activeTab === "attention") run(() => rejectBlog(blogId, comments));
    else if (activeTab === "suspend") run(() => suspendBlog(blogId, comments));
    else if (activeTab === "withdraw") run(() => withdrawBlog(blogId, comments));
  }

  return (
    <div>
      <div className="map-card" style={{ padding: 18 }}>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>Decision</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button type="button" className="btn btn-primary btn-small" disabled={isPending} onClick={() => run(() => approveBlog(blogId))}>
            Approve
          </button>
          <button type="button" className={`btn btn-small ${activeTab === "attention" ? "btn-primary" : "btn-ghost"}`} disabled={isPending} onClick={() => { setActiveTab(activeTab === "attention" ? null : "attention"); setError(null); }}>
            Attention
          </button>
          <button type="button" className={`btn btn-small ${activeTab === "suspend" ? "btn-primary" : "btn-ghost"}`} disabled={isPending} onClick={() => { setActiveTab(activeTab === "suspend" ? null : "suspend"); setError(null); }}>
            Suspend
          </button>
          <button type="button" className={`btn btn-small ${activeTab === "withdraw" ? "btn-primary" : "btn-ghost"}`} disabled={isPending} onClick={() => { setActiveTab(activeTab === "withdraw" ? null : "withdraw"); setError(null); }}>
            Withdraw
          </button>
        </div>
      </div>

      {activeTab && (
        <div className="map-card" style={{ padding: 18, marginTop: 16 }}>
          <label className="field-label" htmlFor="blog-decision-note">
            {activeTab === "attention"
              ? "What needs to change? (sent to the writer)"
              : `Reason for ${activeTab === "suspend" ? "suspending" : "withdrawing"} (sent to the writer)`}
          </label>
          <textarea className="field" id="blog-decision-note" rows={4} value={comments} onChange={(e) => setComments(e.target.value)} />
          {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button type="button" className="btn btn-primary btn-small" disabled={isPending} onClick={handleSend}>
              {isPending ? "Sending…" : "Send"}
            </button>
            <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => { setActiveTab(null); setComments(""); setError(null); }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
