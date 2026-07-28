"use client";

import { useState } from "react";
import { EbookSubmissionForm } from "./EbookSubmissionForm";
import { PrintSubmissionForm } from "./PrintSubmissionForm";

/** Top-level tab switcher for the three submission workflows — eBook,
 * Print Copy (a fully dedicated Lulu print-on-demand workflow, see
 * PrintSubmissionForm.tsx), and Audio book (not yet built out to the
 * same depth as the other two). */
export function NewBookFormTabs() {
  const [activeFormat, setActiveFormat] = useState<"ebook" | "print" | "audiobook">("ebook");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          {(["ebook", "print", "audiobook"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`btn btn-small ${activeFormat === f ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setActiveFormat(f)}
            >
              {f === "ebook" ? "eBook" : f === "print" ? "Print Copy" : "Audio book"}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
          {activeFormat === "print"
            ? "A dedicated workflow for printed books, fulfilled through our print-on-demand partner."
            : "Publishing a printed book? The Print Copy tab opens our dedicated print publishing workflow, including cover wrap preview and print-on-demand fulfillment."}
        </p>
      </div>

      {activeFormat === "ebook" && <EbookSubmissionForm />}
      {activeFormat === "print" && <PrintSubmissionForm />}
      {activeFormat === "audiobook" && (
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
