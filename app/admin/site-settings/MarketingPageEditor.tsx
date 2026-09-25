"use client";

import { ImageUploadField } from "@/components/ImageUploadField";
import { PageBodyEditor } from "@/components/PageBodyEditor";
import type { MarketingPageContent } from "@/lib/page-content";

/**
 * The banner at the top of Authorship/Affiliate stays exactly as it
 * renders now — its own eyebrow/heading/intro text and its own image
 * upload, unchanged. Everything that used to be the separate,
 * structured "Sections" editor below it is now one single free-text
 * editing pane (bodyHtml) instead — written or pasted in as one block,
 * per explicit instruction, rather than field-by-field picture/text
 * entries.
 */
export function MarketingPageEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: MarketingPageContent;
  onChange: (next: MarketingPageContent) => void;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 15, marginBottom: 10 }}>{label} — banner</h3>
      <p className="field-hint" style={{ margin: "0 0 10px" }}>
        The banner at the top of the page — stays exactly as it currently appears.
      </p>
      <label className="field-label">Eyebrow text</label>
      <input className="field" type="text" value={value.eyebrow} onChange={(e) => onChange({ ...value, eyebrow: e.target.value })} />
      <label className="field-label">Hero heading</label>
      <input className="field" type="text" value={value.heading} onChange={(e) => onChange({ ...value, heading: e.target.value })} />
      <label className="field-label">Hero intro text</label>
      <textarea className="field" rows={2} value={value.introText} onChange={(e) => onChange({ ...value, introText: e.target.value })} />
      <ImageUploadField
        label="Banner image"
        recommendedSize="Recommended 1200×600px — same size as the homepage hero banners"
        value={value.heroImage}
        onChange={(url) => onChange({ ...value, heroImage: url })}
      />

      <h3 style={{ fontSize: 15, margin: "22px 0 10px" }}>{label} — page content</h3>
      <PageBodyEditor value={value.bodyHtml} onChange={(html) => onChange({ ...value, bodyHtml: html })} />
    </div>
  );
}
