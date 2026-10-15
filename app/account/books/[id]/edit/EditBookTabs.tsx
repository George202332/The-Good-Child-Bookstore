"use client";

import { useState } from "react";
import { EbookSubmissionForm, type EbookSubmissionInitial } from "../../new/EbookSubmissionForm";
import { PrintSubmissionForm, type PrintSubmissionInitial } from "../../new/PrintSubmissionForm";
import type { SharedSubmissionFields } from "../../new/shared";

type Format = "ebook" | "print";

/** What one tab holds: an existing edition to edit, or nothing yet (the
 * author can add that edition from here, pre-filled from the other one). */
export type EditTab =
  | { mode: "edit"; status: string }
  | { mode: "add" };

/**
 * The edit page's tab bar — the same two tabs as "Submit a new title":
 * "eBook / Audiobook" and "Print Copy". Each is its own edition of the
 * title, so each is edited on its own tab with its own Save button.
 * If the title has no edition in a format yet, that tab offers to add it
 * (pre-filled with this title's details) instead of editing.
 *
 * Both forms stay mounted while you switch tabs, so unsaved typing on one
 * tab is never lost by looking at the other.
 */
export function EditBookTabs({
  startOn,
  enabledFormats,
  ebookTab,
  printTab,
  ebookInitial,
  printInitial,
  addPrefill,
  combined = false,
}: {
  startOn: Format;
  enabledFormats: { ebook: boolean; print: boolean; audiobook: boolean };
  ebookTab: EditTab;
  printTab: EditTab;
  ebookInitial?: EbookSubmissionInitial;
  printInitial?: PrintSubmissionInitial;
  /** The title's shared details, used to pre-fill an edition being added. */
  addPrefill: SharedSubmissionFields;
  /** A title created with eBook and print together: one form, no tabs. */
  combined?: boolean;
}) {
  const [active, setActive] = useState<Format>(startOn);
  const [shared, setShared] = useState<SharedSubmissionFields | undefined>(undefined);

  const tabs: { key: Format; label: string; tab: EditTab }[] = [
    { key: "ebook", label: "eBook / Audiobook", tab: ebookTab },
    { key: "print", label: "Print Copy", tab: printTab },
  ];

  function hint(key: Format, tab: EditTab): string {
    if (tab.mode === "add") {
      return key === "print"
        ? "This title has no print edition yet. Fill in the details below to add one — your title, author and description are already filled in."
        : "This title has no eBook / audiobook edition yet. Fill in the details below to add one — your title, author and description are already filled in.";
    }
    return key === "print"
      ? "You are editing the print edition. Changes here only affect the printed book."
      : "You are editing the eBook / audiobook edition. Changes here only affect the eBook and audiobook.";
  }

  if (combined && ebookInitial) {
    return <EbookSubmissionForm initial={ebookInitial} audiobookEnabled={enabledFormats.audiobook} />;
  }

  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div role="tablist" style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active === t.key}
              className={`btn btn-small ${active === t.key ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setActive(t.key)}
            >
              {t.label}
              {t.tab.mode === "add" ? " (add)" : ""}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>{hint(current.key, current.tab)}</p>
      </div>

      <div style={{ display: active === "ebook" ? "block" : "none" }}>
        {ebookTab.mode === "edit" && ebookInitial ? (
          <EbookSubmissionForm initial={ebookInitial} audiobookEnabled={enabledFormats.audiobook} />
        ) : enabledFormats.ebook ? (
          <EbookSubmissionForm audiobookEnabled={enabledFormats.audiobook} onSharedFieldsChange={setShared} />
        ) : (
          <ClosedNote />
        )}
      </div>
      <div style={{ display: active === "print" ? "block" : "none" }}>
        {printTab.mode === "edit" && printInitial ? (
          <PrintSubmissionForm initial={printInitial} />
        ) : enabledFormats.print ? (
          <PrintSubmissionForm prefill={shared ?? addPrefill} />
        ) : (
          <ClosedNote />
        )}
      </div>
    </div>
  );
}

function ClosedNote() {
  return (
    <div className="form-section" style={{ background: "var(--cream)" }}>
      <p style={{ fontSize: 13.5, color: "var(--ink-soft)" }}>New submissions aren&apos;t open in this format right now — check back soon.</p>
    </div>
  );
}
