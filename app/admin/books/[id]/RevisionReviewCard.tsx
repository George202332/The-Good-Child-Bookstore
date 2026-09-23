"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveBookRevision, rejectBookRevision } from "@/actions/submissions";

interface RevisionPreview {
  title: string;
  description: string;
  price: number;
}

export function RevisionReviewCard({ bookId, revision }: { bookId: string; revision: RevisionPreview }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleApprove() {
    startTransition(async () => {
      const res = await approveBookRevision(bookId);
      if (!res.ok) setError(res.error ?? "Couldn't approve this revision.");
      else router.refresh();
    });
  }

  function handleReject() {
    startTransition(async () => {
      const res = await rejectBookRevision(bookId);
      if (!res.ok) setError(res.error ?? "Couldn't reject this revision.");
      else router.refresh();
    });
  }

  return (
    <div className="map-card" style={{ padding: 20, background: "rgba(91,141,239,0.08)", border: "1px solid var(--admin-accent, #5B8DEF)" }}>
      <h3 style={{ fontSize: 15, marginBottom: 8, color: "var(--admin-accent, #5B8DEF)" }}>Pending revision</h3>
      <p className="field-hint" style={{ margin: "0 0 14px" }}>
        This book is live and visible to customers with its current details. Below is what the author is proposing
        to change — nothing on the live listing changes until you approve it.
      </p>
      <div style={{ marginBottom: 6 }}><strong>Proposed title:</strong> {revision.title}</div>
      <div style={{ marginBottom: 6 }}><strong>Proposed price:</strong> ${revision.price.toFixed(2)}</div>
      <div style={{ marginBottom: 14 }}>
        <strong>Proposed description:</strong>
        <p style={{ fontSize: 13.5, color: "var(--admin-text-faint, #6B7385)", marginTop: 4 }}>{revision.description}</p>
      </div>
      {error && <p style={{ fontSize: 12.5, color: "var(--admin-danger, #B7472A)", marginBottom: 10 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn btn-primary btn-small" disabled={isPending} onClick={handleApprove}>
          {isPending ? "…" : "Approve revision"}
        </button>
        <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={handleReject}>
          Reject revision
        </button>
      </div>
    </div>
  );
}
