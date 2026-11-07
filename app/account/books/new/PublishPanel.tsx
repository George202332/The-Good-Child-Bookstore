"use client";

import { Card, SectionHeader } from "./shared";

export interface ChecklistItem {
  label: string;
  ok: boolean;
  /** The id of the form section (Card) the item belongs to, so it can be highlighted. */
  section: string;
}

export interface PublishNotice { kind: "ok" | "error"; text: string }

/**
 * The live publishing checklist and the action buttons, shared by the eBook / Audiobook tab and the Print tab.
 * The checklist is built from the same rules that decide whether a book can be published (each form passes its
 * own list), so what is shown here and what is enforced never disagree. Save Draft sits on the left, then Publish, and
 * Delete Book (passed in as `extraActions`) at the far right of the row, with a gap between them. Messages
 * appear right below the buttons.
 */
export function PublishPanel({
  n, sub, items, showMissing, showPublish, publishLabel = "Publish", publishingLabel = "Publishing…", busy, onSave, onPublish, notice, extraActions, children, missingIntro = "Please finish these before publishing:",
}: {
  missingIntro?: string;
  n: number;
  sub: string;
  items: ChecklistItem[];
  /** True after Publish was pressed with something missing: the error and section outlines show until it is fixed. */
  showMissing: boolean;
  showPublish: boolean;
  /** "Republish" when the book is already published and this sends an edit for review. */
  publishLabel?: string;
  publishingLabel?: string;
  busy: "idle" | "saving" | "publishing";
  onSave: () => void;
  onPublish: () => void;
  notice: PublishNotice | null;
  extraActions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const missing = items.filter((i) => !i.ok);
  const working = busy !== "idle";
  return (
    <Card id="sec-publish">
      <SectionHeader n={n} title="Publishing Checklist" sub={sub} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((c) => (
          <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: c.ok ? "#165236" : "var(--coral-deep)" }}>
            {c.ok ? (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true"><path d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
            )}
            <span>{c.label}{!c.ok && " (missing)"}</span>
          </div>
        ))}
      </div>
      {children}
      <div className="publish-row">
        <div className="publish-row-main">
          <button type="button" className="btn btn-ghost btn-small" disabled={working} onClick={onSave}>
            {busy === "saving" ? "Saving…" : "Save Draft"}
          </button>
          {showPublish && (
            <button type="button" className="btn btn-primary btn-small" disabled={working} onClick={onPublish}>
              {busy === "publishing" ? publishingLabel : publishLabel}
            </button>
          )}
        </div>
        {extraActions && <div className="publish-row-end">{extraActions}</div>}
      </div>
      {showMissing && missing.length > 0 && (
        <div role="alert" className="publish-msg is-error">
          {missingIntro}
          <ul>{missing.map((m) => <li key={m.label}>{m.label}</li>)}</ul>
        </div>
      )}
      {notice && (
        <div role={notice.kind === "error" ? "alert" : "status"} className={`publish-msg ${notice.kind === "ok" ? "is-ok" : "is-error"}`}>{notice.text}</div>
      )}
    </Card>
  );
}

/** Scrolls to the first form section that still has something missing. */
export function scrollToFirstMissing(items: ChecklistItem[]) {
  const first = items.find((i) => !i.ok);
  if (!first) return;
  document.getElementById(`sec-${first.section}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
}
