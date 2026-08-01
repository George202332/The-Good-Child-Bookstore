"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveBook, rejectBook, proposeOrApplySuspend, proposeOrApplyWithdraw, ratifyPendingModeration } from "@/actions/admin";

type Mode = "idle" | "revision" | "suspend" | "withdraw";

export function ReviewActions({
  bookId,
  role,
  pendingAction,
  pendingActionBy,
}: {
  bookId: string;
  role: string;
  pendingAction: string | null;
  pendingActionBy: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>("idle");
  const [comments, setComments] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok: boolean; error?: string }>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (!res.ok) setError(res.error ?? "Failed");
      else {
        setMode("idle");
        setComments("");
        onDone?.();
        router.refresh();
      }
    });
  }

  if (pendingAction) {
    return (
      <div className="map-card" style={{ padding: 18, background: "#FBE6B8" }}>
        <h3 style={{ fontSize: 14, marginBottom: 8, color: "#8A5A0B" }}>Awaiting Admin ratification</h3>
        <p style={{ fontSize: 13, color: "#8A5A0B", marginBottom: 12 }}>
          {pendingActionBy ?? "An editor"} proposed to <strong>{pendingAction === "SUSPEND" ? "Suspend" : "Withdraw"}</strong> this book.
        </p>
        {role === "ADMIN" ? (
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-primary btn-small" disabled={isPending} onClick={() => run(() => ratifyPendingModeration(bookId, true))}>
              Ratify
            </button>
            <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => run(() => ratifyPendingModeration(bookId, false))}>
              Decline
            </button>
          </div>
        ) : (
          <p style={{ fontSize: 12.5, color: "#8A5A0B" }}>Only an Admin can finalize this.</p>
        )}
        {error && <div className="field-hint" style={{ color: "var(--coral-deep)", marginTop: 8 }}>{error}</div>}
      </div>
    );
  }

  return (
    <div className="map-card" style={{ padding: 18 }}>
      <h3 style={{ fontSize: 14, marginBottom: 12 }}>Decision</h3>
      {mode === "idle" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button type="button" className="btn btn-primary btn-small" disabled={isPending} onClick={() => run(() => approveBook(bookId))}>
            Approve
          </button>
          <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => setMode("revision")}>
            Attention (send back for revision)
          </button>
          <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => setMode("suspend")}>
            Suspend
          </button>
          <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => setMode("withdraw")}>
            Withdraw
          </button>
        </div>
      )}

      {mode !== "idle" && (
        <div>
          <label className="field-label" htmlFor="decision-note">
            {mode === "revision" ? "What needs to change?" : mode === "suspend" ? "Reason for suspending (dispute, copyright, etc.)" : "Reason for withdrawing"}
          </label>
          <textarea className="field" id="decision-note" rows={4} value={comments} onChange={(e) => setComments(e.target.value)} />
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              className="btn btn-primary btn-small"
              disabled={isPending}
              onClick={() => {
                if (!comments.trim()) { setError("Add a comment first."); return; }
                if (mode === "revision") run(() => rejectBook(bookId, comments));
                else if (mode === "suspend") run(() => proposeOrApplySuspend(bookId, comments));
                else run(() => proposeOrApplyWithdraw(bookId, comments));
              }}
            >
              {isPending ? "Working…" : mode === "revision" ? "Send back for revision" : role === "ADMIN" ? `Confirm ${mode === "suspend" ? "Suspend" : "Withdraw"}` : "Propose to Admin"}
            </button>
            <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => { setMode("idle"); setError(null); }}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <div className="field-hint" style={{ color: "var(--coral-deep)", marginTop: 8 }}>{error}</div>}
    </div>
  );
}
