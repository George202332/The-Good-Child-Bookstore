"use client";

import { useState } from "react";
import { ManuscriptReviewViewer } from "./ManuscriptReviewViewer";

/**
 * "Read sample" — per explicit instruction, this is NOT a separate set
 * of uploaded sample images. It's the first 6 pages of the exact same
 * PDF manuscript the author uploaded for the eBook itself, rendered
 * with the same page-by-page viewer used for editor/admin review.
 * There's nothing extra for an author to manage — if they've uploaded
 * a PDF manuscript, the sample already exists.
 */
export function ReadSampleViewer({ manuscriptUrl, title }: { manuscriptUrl: string | undefined; title: string }) {
  const [open, setOpen] = useState(false);

  if (!manuscriptUrl) {
    return (
      <button type="button" className="btn btn-ghost btn-small btn-block" disabled title="No sample available for this book yet">
        Read sample
      </button>
    );
  }

  return (
    <>
      <button type="button" className="btn btn-ghost btn-small btn-block" onClick={() => setOpen(true)}>
        Read sample
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: "fixed", inset: 0, background: "rgba(20,14,26,0.85)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{ background: "var(--paper)", borderRadius: 16, padding: 20, maxWidth: 640, width: "100%", position: "relative" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, margin: 0 }}>{title} — Sample (first pages)</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--ink-faint)", lineHeight: 1 }}>×</button>
            </div>
            <ManuscriptReviewViewer url={manuscriptUrl} title={title} maxPages={6} />
          </div>
        </div>
      )}
    </>
  );
}
