"use client";

import { useState } from "react";
import { EbookSubmissionForm } from "./EbookSubmissionForm";
import { PrintSubmissionForm } from "./PrintSubmissionForm";
import type { SharedSubmissionFields } from "./shared";

type Format = "ebook" | "print";

/** Top-level tab switcher for the submission workflow — exactly two
 * tabs: "eBook / Audiobook" (an optional audiobook file/price live
 * right inside that same form now — there's no separate Audiobook tab
 * any more) and "Print Copy" (a fully dedicated Lulu print-on-demand
 * workflow, see PrintSubmissionForm.tsx). Admin still controls whether
 * each is currently open for submission from Book Management — a
 * format switched off there doesn't render as a tab here at all, and
 * turning off "Audio book" there hides just the audiobook upload field
 * on the eBook tab, not the whole tab.
 *
 * Whatever shared fields (title, author, description, category, age
 * range, etc — see SharedSubmissionFields) the author enters on the
 * eBook tab are lifted up here and handed to the Print tab as a
 * one-time prefill, so nothing has to be re-typed. */
export function NewBookFormTabs({ enabledFormats }: { enabledFormats: { ebook: boolean; print: boolean; audiobook: boolean } }) {
  const ALL_FORMATS: { key: Format; label: string }[] = [
    { key: "ebook", label: "eBook / Audiobook" },
    { key: "print", label: "Print Copy" },
  ];
  const visibleFormats = ALL_FORMATS.filter((f) => enabledFormats[f.key]);
  const [activeFormat, setActiveFormat] = useState<Format>(visibleFormats[0]?.key ?? "ebook");
  const [sharedFields, setSharedFields] = useState<SharedSubmissionFields | undefined>(undefined);

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
            ? "A dedicated workflow for printed books, fulfilled through our print-on-demand partner. Whatever you already entered on the eBook / Audiobook tab is pre-filled below."
            : "Publish an eBook with an optional audiobook edition right on this tab. Publishing a printed book? The Print Copy tab opens our dedicated print publishing workflow, including cover wrap preview and print-on-demand fulfillment."}
        </p>
      </div>

      {activeFormat === "ebook" && enabledFormats.ebook && (
        <EbookSubmissionForm audiobookEnabled={enabledFormats.audiobook} onSharedFieldsChange={setSharedFields} />
      )}
      {activeFormat === "print" && enabledFormats.print && <PrintSubmissionForm prefill={sharedFields} />}
    </div>
  );
}
