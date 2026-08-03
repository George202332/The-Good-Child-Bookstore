"use client";

import type { LegalPageContent, LegalPageSection } from "@/lib/page-content";

function newId(): string {
  return `item_${Math.random().toString(36).slice(2, 8)}`;
}

export function LegalPageEditor({
  label,
  headingLabel,
  value,
  onChange,
}: {
  label: string;
  headingLabel: string;
  value: LegalPageContent;
  onChange: (next: LegalPageContent) => void;
}) {
  function updateSection(id: string, patch: Partial<LegalPageSection>) {
    onChange({ ...value, sections: value.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  }
  function addSection() {
    onChange({ ...value, sections: [...value.sections, { id: newId(), heading: "", body: "" }] });
  }
  function removeSection(id: string) {
    onChange({ ...value, sections: value.sections.filter((s) => s.id !== id) });
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 15, marginBottom: 10 }}>{label}</h3>
      <label className="field-label">Page title</label>
      <input className="field" type="text" value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} />
      <label className="field-label">Intro text</label>
      <textarea className="field" rows={2} value={value.intro} onChange={(e) => onChange({ ...value, intro: e.target.value })} />

      {value.sections.map((s) => (
        <div key={s.id} className="map-card" style={{ padding: 16, marginBottom: 10, background: "var(--cream)" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => removeSection(s.id)}>Remove</button>
          </div>
          <label className="field-label">{headingLabel}</label>
          <input className="field" type="text" value={s.heading} onChange={(e) => updateSection(s.id, { heading: e.target.value })} />
          <label className="field-label">Body</label>
          <textarea className="field" rows={3} value={s.body} onChange={(e) => updateSection(s.id, { body: e.target.value })} />
        </div>
      ))}
      <button type="button" className="btn btn-ghost btn-small" onClick={addSection}>+ Add {headingLabel.toLowerCase()}</button>
    </div>
  );
}
