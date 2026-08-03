"use client";

import { ImageUploadField } from "@/components/ImageUploadField";
import type { MarketingPageContent, MarketingPageSection } from "@/lib/page-content";

function newId(): string {
  return `section_${Math.random().toString(36).slice(2, 8)}`;
}

export function MarketingPageEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: MarketingPageContent;
  onChange: (next: MarketingPageContent) => void;
}) {
  function updateSection(id: string, patch: Partial<MarketingPageSection>) {
    onChange({ ...value, sections: value.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  }
  function addSection() {
    onChange({ ...value, sections: [...value.sections, { id: newId(), title: "", paragraphs: [""] }] });
  }
  function removeSection(id: string) {
    onChange({ ...value, sections: value.sections.filter((s) => s.id !== id) });
  }
  function moveSection(id: string, dir: -1 | 1) {
    const i = value.sections.findIndex((s) => s.id === id);
    const j = i + dir;
    if (j < 0 || j >= value.sections.length) return;
    const next = [...value.sections];
    [next[i], next[j]] = [next[j], next[i]];
    onChange({ ...value, sections: next });
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 15, marginBottom: 10 }}>{label}</h3>
      <label className="field-label">Eyebrow text</label>
      <input className="field" type="text" value={value.eyebrow} onChange={(e) => onChange({ ...value, eyebrow: e.target.value })} />
      <label className="field-label">Hero heading</label>
      <input className="field" type="text" value={value.heading} onChange={(e) => onChange({ ...value, heading: e.target.value })} />
      <label className="field-label">Hero intro text</label>
      <textarea className="field" rows={2} value={value.introText} onChange={(e) => onChange({ ...value, introText: e.target.value })} />
      <ImageUploadField
        label="Hero background image"
        recommendedSize="Recommended 1200×600px — same size as the homepage hero banners"
        value={value.heroImage}
        onChange={(url) => onChange({ ...value, heroImage: url })}
      />

      <label className="field-label" style={{ marginTop: 10 }}>Sections</label>
      {value.sections.map((s, i) => (
        <div key={s.id} className="map-card" style={{ padding: 16, marginBottom: 12, background: "var(--cream)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 11.5, color: "var(--ink-faint)", fontWeight: 700 }}>SECTION {i + 1}</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => moveSection(s.id, -1)} disabled={i === 0}>↑</button>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => moveSection(s.id, 1)} disabled={i === value.sections.length - 1}>↓</button>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => removeSection(s.id)}>Remove</button>
            </div>
          </div>
          <label className="field-label">Title</label>
          <input className="field" type="text" value={s.title} onChange={(e) => updateSection(s.id, { title: e.target.value })} />
          <label className="field-label">Paragraphs (one per line)</label>
          <textarea
            className="field"
            rows={4}
            value={s.paragraphs.join("\n\n")}
            onChange={(e) => updateSection(s.id, { paragraphs: e.target.value.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) })}
          />
          <ImageUploadField
            label="Section image"
            recommendedSize="Recommended 1000×700px"
            value={s.imageUrl}
            onChange={(url) => updateSection(s.id, { imageUrl: url })}
          />
        </div>
      ))}
      <button type="button" className="btn btn-ghost btn-small" onClick={addSection}>+ Add section</button>
    </div>
  );
}
