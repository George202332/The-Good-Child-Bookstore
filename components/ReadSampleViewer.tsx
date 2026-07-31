"use client";

import { useState } from "react";

export function ReadSampleViewer({ pages, title }: { pages: string[]; title: string }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  if (pages.length === 0) {
    return (
      <button type="button" className="btn btn-ghost btn-small btn-block" disabled title="No sample pages have been uploaded for this book yet">
        Read sample
      </button>
    );
  }

  return (
    <>
      <button type="button" className="btn btn-ghost btn-small btn-block" onClick={() => { setIndex(0); setOpen(true); }}>
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
            style={{ background: "var(--paper)", borderRadius: 16, padding: 20, maxWidth: 560, width: "100%", position: "relative" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, margin: 0 }}>{title} — Sample</h3>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--ink-faint)", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: "flex", justifyContent: "center", background: "var(--cream)", borderRadius: 10, overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- real uploaded sample page */}
              <img src={pages[index]} alt={`${title} — page ${index + 1}`} style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", display: "block" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
              <button type="button" className="btn btn-ghost btn-small" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))}>← Previous</button>
              <span style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>Page {index + 1} of {pages.length}</span>
              <button type="button" className="btn btn-ghost btn-small" disabled={index === pages.length - 1} onClick={() => setIndex((i) => Math.min(pages.length - 1, i + 1))}>Next →</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
