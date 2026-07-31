"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveBook, rejectBook } from "@/actions/admin";

export function ReviewActions({ bookId }: { bookId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [comments, setComments] = useState("");
  const [showRevisionBox, setShowRevisionBox] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleApprove() {
    setError(null);
    startTransition(async () => {
      const res = await approveBook(bookId);
      if (!res.ok) setError(res.error ?? "Failed");
      else router.refresh();
    });
  }

  function handleSendBack() {
    if (!comments.trim()) {
      setError("Add a comment explaining what needs to change before sending this back.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await rejectBook(bookId, comments);
      if (!res.ok) setError(res.error ?? "Failed");
      else {
        setComments("");
        setShowRevisionBox(false);
        router.refresh();
      }
    });
  }

  return (
    <div>
      {!showRevisionBox ? (
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="btn btn-primary btn-small" disabled={isPending} onClick={handleApprove}>
            {isPending ? "Working…" : "Approve"}
          </button>
          <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => setShowRevisionBox(true)}>
            Set on revision
          </button>
        </div>
      ) : (
        <div>
          <label className="field-label" htmlFor="revision-comments">What needs to change?</label>
          <textarea
            className="field"
            id="revision-comments"
            rows={4}
            placeholder="Be specific — this is exactly what the author will see."
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" className="btn btn-primary btn-small" disabled={isPending} onClick={handleSendBack}>
              {isPending ? "Sending…" : "Send back for revision"}
            </button>
            <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => { setShowRevisionBox(false); setError(null); }}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {error && <div className="field-hint" style={{ color: "var(--coral-deep)", marginTop: 8 }}>{error}</div>}
    </div>
  );
}
