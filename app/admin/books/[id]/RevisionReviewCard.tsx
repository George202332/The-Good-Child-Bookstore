"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveBookRevision, rejectBookRevision } from "@/actions/submissions";

interface RevisionPreview {
  title: string;
  description: string;
  price: number;
}

interface FilesPreview {
  manuscriptUrl?: string;
  coverUrl?: string;
}

export function RevisionReviewCard({ bookId, revision, files }: { bookId: string; revision?: RevisionPreview; files?: FilesPreview }) {
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
      {files ? (
        <>
          <p className="field-hint" style={{ margin: "0 0 14px" }}>
            The author replaced a file on this live book. All of their other edits are already live; the book keeps
            serving its current manuscript and cover until you approve the replacement below.
          </p>
          {files.manuscriptUrl && (
            <div style={{ marginBottom: 6 }}>
              New manuscript: <a href={files.manuscriptUrl} target="_blank" rel="noreferrer">open the uploaded file</a>
            </div>
          )}
          {files.coverUrl && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ marginBottom: 6 }}>New cover:</div>
              {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded cover */}
              <img src={files.coverUrl} alt="Proposed new cover" style={{ width: 140, borderRadius: 8, border: "1px solid var(--line)" }} />
            </div>
          )}
        </>
      ) : revision ? (
        <>
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
        </>
      ) : null}
      {error && <p style={{ fontSize: 12.5, color: "var(--admin-danger, #8C2F16)", marginBottom: 10 }}>{error}</p>}
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
