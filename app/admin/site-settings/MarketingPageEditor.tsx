"use client";

import { ImageUploadField } from "@/components/ImageUploadField";
import { PageBodyEditor } from "@/components/PageBodyEditor";
import type { MarketingPageContent } from "@/lib/page-content";

/**
 * Authorship and Affiliate each have TWO banners and both are editable
 * here: Banner 1 at the top (eyebrow/heading/intro text + image) and
 * Banner 2 lower down (heading, optional text + image). Everything that used to be the separate,
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
      <h3 style={{ fontSize: 15, marginBottom: 10 }}>{label} — Banner 1 (top of the page)</h3>
      <p className="field-hint" style={{ margin: "0 0 10px" }}>
        The banner at the very top of the page.
      </p>
      <label className="field-label">Eyebrow text</label>
      <input className="field" type="text" value={value.eyebrow} onChange={(e) => onChange({ ...value, eyebrow: e.target.value })} />
      <label className="field-label">Hero heading</label>
      <input className="field" type="text" value={value.heading} onChange={(e) => onChange({ ...value, heading: e.target.value })} />
      <label className="field-label">Hero intro text</label>
      <textarea className="field" rows={2} value={value.introText} onChange={(e) => onChange({ ...value, introText: e.target.value })} />
      <ImageUploadField
        label="Banner 1 image"
        recommendedSize="Recommended 1200×600px — same size as the homepage hero banners"
        value={value.heroImage}
        onChange={(url) => onChange({ ...value, heroImage: url })}
      />

      <h3 style={{ fontSize: 15, margin: "22px 0 10px" }}>{label} — Banner 2 (lower on the page, above the FAQs)</h3>
      <p className="field-hint" style={{ margin: "0 0 10px" }}>
        The second banner, with the sign-up buttons. Its buttons stay as they are; you control its heading, optional text and image.
      </p>
      <label className="field-label">Banner 2 heading</label>
      <input className="field" type="text" value={value.ctaBannerTitle} onChange={(e) => onChange({ ...value, ctaBannerTitle: e.target.value })} />
      <label className="field-label">Banner 2 text (optional — leave empty to show only the heading)</label>
      <textarea className="field" rows={2} value={value.ctaBannerBody} onChange={(e) => onChange({ ...value, ctaBannerBody: e.target.value })} />
      <ImageUploadField
        label="Banner 2 image"
        recommendedSize="Recommended 1200×600px — same size as Banner 1"
        value={value.ctaBannerImage}
        onChange={(url) => onChange({ ...value, ctaBannerImage: url })}
      />

      <h3 style={{ fontSize: 15, margin: "22px 0 10px" }}>{label} — page content</h3>
      <PageBodyEditor value={value.bodyHtml} onChange={(html) => onChange({ ...value, bodyHtml: html })} />
    </div>
  );
}
