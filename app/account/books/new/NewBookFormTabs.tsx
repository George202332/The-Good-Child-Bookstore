"use client";

import { useState } from "react";
import { EbookSubmissionForm } from "./EbookSubmissionForm";
import { PrintSubmissionForm } from "./PrintSubmissionForm";

type Format = "ebook" | "print" | "audiobook";

/** Top-level tab switcher for the three submission workflows — eBook,
 * Print Copy (a fully dedicated Lulu print-on-demand workflow, see
 * PrintSubmissionForm.tsx), and Audio book (not yet built out to the
 * same depth as the other two). Admin controls which of these are
 * currently open for submission from Book Management — a format
 * switched off there simply doesn't render as a tab here at all. */
export function NewBookFormTabs({ enabledFormats }: { enabledFormats: { ebook: boolean; print: boolean; audiobook: boolean } }) {
  const ALL_FORMATS: { key: Format; label: string }[] = [
    { key: "ebook", label: "eBook" },
    { key: "print", label: "Print Copy" },
    { key: "audiobook", label: "Audio book" },
  ];
  const visibleFormats = ALL_FORMATS.filter((f) => enabledFormats[f.key]);
  const [activeFormat, setActiveFormat] = useState<Format>(visibleFormats[0]?.key ?? "ebook");

  if (visibleFormats.length === 0) {
    return (
      <div className="form-section" style={{ background: "var(--cream)" }}>
        <p style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>
          New submissions aren&apos;t open in any format right now — check back soon.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          {visibleFormats.map((f) => (
            <button
              key={f.key}
              type="button"
              className={`btn btn-small ${activeFormat === f.key ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setActiveFormat(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
          {activeFormat === "print"
            ? "A dedicated workflow for printed books, fulfilled through our print-on-demand partner."
            : "Publishing a printed book? The Print Copy tab opens our dedicated print publishing workflow, including cover wrap preview and print-on-demand fulfillment."}
        </p>
      </div>

      {activeFormat === "ebook" && enabledFormats.ebook && <EbookSubmissionForm />}
      {activeFormat === "print" && enabledFormats.print && <PrintSubmissionForm />}
      {activeFormat === "audiobook" && enabledFormats.audiobook && (
        <div className="form-section">
          <p style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>
            The Audio book submission workflow isn&apos;t built out to the same depth as eBook and Print Copy yet —
            that&apos;s real, separate follow-up work.
          </p>
        </div>
      )}
    </div>
  );
}
