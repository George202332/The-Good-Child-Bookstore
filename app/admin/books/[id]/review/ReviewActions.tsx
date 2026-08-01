"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveBook, rejectBook, proposeOrApplySuspend, proposeOrApplyWithdraw, ratifyPendingModeration } from "@/actions/admin";

type Tab = "attention" | "suspend" | "withdraw" | null;

/**
 * Approve / Attention / Suspend / Withdraw sit as one row of tabs,
 * always visible together — not a form that replaces the buttons.
 * Clicking Attention, Suspend, or Withdraw opens a separate message-box
 * card below this one; nothing happens until Send is clicked. Approve
 * still takes effect immediately, with no message needed.
 */
export function ReviewActions({
  bookId,
  canRatify,
  pendingAction,
  pendingActionBy,
}: {
  bookId: string;
  canRatify: boolean;
  pendingAction: string | null;
  pendingActionBy: string | null;
}) {
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
    if (activeTab === "attention") run(() => rejectBook(bookId, comments));
    else if (activeTab === "suspend") run(() => proposeOrApplySuspend(bookId, comments));
    else if (activeTab === "withdraw") run(() => proposeOrApplyWithdraw(bookId, comments));
  }

  if (pendingAction) {
    return (
      <div className="map-card" style={{ padding: 18, background: "#FBE6B8" }}>
        <h3 style={{ fontSize: 14, marginBottom: 8, color: "#8A5A0B" }}>Awaiting ratification</h3>
        <p style={{ fontSize: 13, color: "#8A5A0B", marginBottom: 12 }}>
          {pendingActionBy ?? "An editor"} proposed to <strong>{pendingAction === "SUSPEND" ? "Suspend" : "Withdraw"}</strong> this book — Chief Editor and Admin have been notified.
        </p>
        {canRatify ? (
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-primary btn-small" disabled={isPending} onClick={() => run(() => ratifyPendingModeration(bookId, true))}>
              Ratify
            </button>
            <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => run(() => ratifyPendingModeration(bookId, false))}>
              Decline
            </button>
          </div>
        ) : (
          <p style={{ fontSize: 12.5, color: "#8A5A0B" }}>Only an Admin or Chief Editor can finalize this.</p>
        )}
        {error && <div className="field-hint" style={{ color: "var(--coral-deep)", marginTop: 8 }}>{error}</div>}
      </div>
    );
  }

  return (
    <>
      <div className="map-card" style={{ padding: 18 }}>
        <h3 style={{ fontSize: 14, marginBottom: 12 }}>Decision</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button type="button" className="btn btn-primary btn-small" disabled={isPending} onClick={() => run(() => approveBook(bookId))}>
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
          <label className="field-label" htmlFor="decision-note">
            {activeTab === "attention"
              ? "What needs to change? (sent to the author)"
              : `Reason for ${activeTab === "suspend" ? "suspending" : "withdrawing"} (sent to Chief Editor and Admin)`}
          </label>
          <textarea className="field" id="decision-note" rows={4} value={comments} onChange={(e) => setComments(e.target.value)} />
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
    </>
  );
}
