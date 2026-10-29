"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
 * eBook tab are lifted up here and handed to the Print tab, whose own
 * "Autofill from eBook" button copies them (and the cover and file) on request. */
export function NewBookFormTabs({ enabledFormats }: { enabledFormats: { ebook: boolean; print: boolean; audiobook: boolean } }) {
  const ALL_FORMATS: { key: Format; label: string }[] = [
    { key: "ebook", label: "eBook and Audiobook" },
    { key: "print", label: "Print" },
  ];
  const visibleFormats = ALL_FORMATS.filter((f) => enabledFormats[f.key]);
  const [activeFormat, setActiveFormat] = useState<Format>(visibleFormats[0]?.key ?? "ebook");
  const router = useRouter();
  // Set once the eBook / Audiobook part has been saved: the wizard then asks whether to continue on Print.
  const [ebookSaved, setEbookSaved] = useState(false);
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
            ? "A dedicated workflow for printed books, fulfilled through our print-on-demand partner. Use the Autofill from eBook button on this tab to copy what you entered on the eBook and Audiobook tab, including the cover and file."
            : "Publish an eBook with an optional audiobook edition right on this tab. Publishing a printed book? The Print tab opens our dedicated print publishing workflow, including cover wrap preview and print-on-demand fulfillment."}
        </p>
      </div>

      {/* Both forms stay mounted (the inactive one is just hidden) so nothing typed
          on one tab is lost when switching, and the Autofill tab always has the
          eBook details to copy. */}
      {enabledFormats.ebook && (
        <div style={{ display: activeFormat === "ebook" ? "block" : "none" }}>
          {ebookSaved ? (
            <div className="form-section" role="status" style={{ background: "var(--cream)" }}>
              <h3 style={{ fontSize: 15, marginBottom: 6 }}>Your eBook and Audiobook Are Saved</h3>
              {enabledFormats.print ? (
                <>
                  <p style={{ fontSize: 13.5, color: "var(--ink-soft)", marginBottom: 12 }}>
                    Would you like to move on to the Print tab now and add a printed edition of this book? Your title, author, description and cover can be filled in for you.
                  </p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="btn btn-primary btn-small" onClick={() => setActiveFormat("print")}>Yes, Go to the Print Tab</button>
                    <button type="button" className="btn btn-ghost btn-small" onClick={() => router.push("/account/books")}>No, Take Me to My Books</button>
                  </div>
                </>
              ) : (
                <button type="button" className="btn btn-primary btn-small" onClick={() => router.push("/account/books")}>Go to My Books</button>
              )}
            </div>
          ) : (
            <EbookSubmissionForm audiobookEnabled={enabledFormats.audiobook} onSharedFieldsChange={setSharedFields} onSubmitted={() => { setEbookSaved(true); window.scrollTo?.({ top: 0 }); }} />
          )}
        </div>
      )}
      {enabledFormats.print && (
        <div style={{ display: activeFormat === "print" ? "block" : "none" }}>
          <PrintSubmissionForm prefill={enabledFormats.ebook ? sharedFields : undefined} />
        </div>
      )}
    </div>
  );
}
