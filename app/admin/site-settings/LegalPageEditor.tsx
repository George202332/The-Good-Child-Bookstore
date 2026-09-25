"use client";

import { PageBodyEditor } from "@/components/PageBodyEditor";
import type { LegalPageContent } from "@/lib/page-content";

/** One single free-text editing pane per page, replacing the previous
 * structured per-section editor — written or pasted in as one block,
 * per explicit instruction. */
export function LegalPageEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: LegalPageContent;
  onChange: (next: LegalPageContent) => void;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 15, marginBottom: 10 }}>{label}</h3>
      <label className="field-label">Page title</label>
      <input className="field" type="text" value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} />
      <label className="field-label">Intro text</label>
      <textarea className="field" rows={2} value={value.intro} onChange={(e) => onChange({ ...value, intro: e.target.value })} />

      <label className="field-label" style={{ marginTop: 10 }}>Content</label>
      <PageBodyEditor value={value.bodyHtml} onChange={(html) => onChange({ ...value, bodyHtml: html })} />
    </div>
  );
}
