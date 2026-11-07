"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveBookRevision, rejectBookRevision } from "@/actions/submissions";

interface ChangeRow { label: string; before: string; after: string }

interface FilesPreview {
  manuscriptUrl?: string;
  coverUrl?: string;
}

export function RevisionReviewCard({ bookId, state = "PENDING", changes, files, note, editionLabel }: {
  bookId: string;
  /** PENDING: the reviewer can decide. DRAFT: the author has not sent it yet. REJECTED: sent back, waiting for the author. */
  state?: "PENDING" | "DRAFT" | "REJECTED";
  changes?: ChangeRow[];
  files?: FilesPreview;
  note?: string;
  editionLabel?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sendBack, setSendBack] = useState(false);
  const [reason, setReason] = useState("");

  function handleApprove() {
    startTransition(async () => {
      const res = await approveBookRevision(bookId);
      if (!res.ok) setError(res.error ?? "Couldn't approve this edit.");
      else router.refresh();
    });
  }

  function handleSendBack() {
    if (!reason.trim()) { setError("Please write a short note so the author knows what to change."); return; }
    startTransition(async () => {
      const res = await rejectBookRevision(bookId, reason);
      if (!res.ok) setError(res.error ?? "Couldn't send this edit back.");
      else router.refresh();
    });
  }

  return (
    <div className="map-card" style={{ padding: 20, background: "rgba(91,141,239,0.08)", border: "1px solid var(--admin-accent, #5B8DEF)" }}>
      <h3 style={{ fontSize: 15, marginBottom: 8, color: "var(--admin-accent, #5B8DEF)" }}>
        {editionLabel ? `${editionLabel}: ` : ""}{state === "PENDING" ? "Edit Waiting For Review" : state === "DRAFT" ? "Author's Draft Edit" : "Edit Sent Back To The Author"}
      </h3>
      <p className="field-hint" style={{ margin: "0 0 14px" }}>
        {state === "PENDING" && "This book is live with its approved details. Nothing on the live listing changes until you approve this edit. If you send it back, the approved version stays live and the author keeps the edit as a draft."}
        {state === "DRAFT" && "The author has saved an edit but has not sent it for review yet, so there is nothing to decide."}
        {state === "REJECTED" && `Sent back to the author${note ? `: "${note}"` : "."} The approved version is still live.`}
      </p>
      {files && (
        <>
          {files.manuscriptUrl && <div style={{ marginBottom: 6 }}>New manuscript: <a href={files.manuscriptUrl} target="_blank" rel="noreferrer">open the uploaded file</a></div>}
          {files.coverUrl && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ marginBottom: 6 }}>New cover:</div>
              {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded cover */}
              <img src={files.coverUrl} alt="Proposed new cover" style={{ width: 140, borderRadius: 8, border: "1px solid var(--line)" }} />
            </div>
          )}
        </>
      )}
      {changes && (
        <div style={{ marginBottom: 14 }}>
          <strong style={{ fontSize: 13.5 }}>What Changed</strong>
          {changes.length === 0 ? (
            <p className="field-hint" style={{ margin: "6px 0 0" }}>No difference from the live version was found.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 13 }}>
              <thead>
                <tr>
                  {["Detail", "Live Now", "Author's Edit"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--line)", fontSize: 11, textTransform: "uppercase", color: "var(--admin-text-faint, #6B7385)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {changes.map((c) => (
                  <tr key={c.label}>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)", fontWeight: 600, verticalAlign: "top" }}>{c.label}</td>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)", verticalAlign: "top", whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#8C2F16" }}>{c.before}</td>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--line)", verticalAlign: "top", whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#1F6B48" }}>{c.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      {error && <p role="alert" style={{ fontSize: 12.5, color: "var(--admin-danger, #8C2F16)", marginBottom: 10 }}>{error}</p>}
      {state === "PENDING" && (
        <>
          {sendBack && (
            <div style={{ marginBottom: 10 }}>
              <label className="field-label" htmlFor={`sendback-${bookId}`}>Note To The Author</label>
              <textarea id={`sendback-${bookId}`} className="field" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What should the author change?" />
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-primary btn-small" disabled={isPending} onClick={handleApprove}>
              {isPending ? "…" : "Approve Edit"}
            </button>
            {sendBack ? (
              <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={handleSendBack}>Send Back</button>
            ) : (
              <button type="button" className="btn btn-ghost btn-small" disabled={isPending} onClick={() => setSendBack(true)}>Send Back With A Note</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
