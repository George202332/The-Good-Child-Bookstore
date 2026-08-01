"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateReviewChecklistTemplate } from "@/actions/review-checklist-settings";
import type { ChecklistGroup } from "@/lib/review-checklist";

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

export function ChecklistSettingsForm({ initial }: { initial: ChecklistGroup[] }) {
  const router = useRouter();
  const [groups, setGroups] = useState<ChecklistGroup[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function updateGroupLabel(gi: number, label: string) {
    setGroups((prev) => prev.map((g, i) => (i === gi ? { ...g, label } : g)));
  }
  function updateItemLabel(gi: number, ii: number, label: string) {
    setGroups((prev) => prev.map((g, i) => (i !== gi ? g : { ...g, items: g.items.map((it, j) => (j === ii ? { ...it, label } : it)) })));
  }
  function addItem(gi: number) {
    setGroups((prev) => prev.map((g, i) => (i !== gi ? g : { ...g, items: [...g.items, { id: newId("item"), label: "" }] })));
  }
  function removeItem(gi: number, ii: number) {
    setGroups((prev) => prev.map((g, i) => (i !== gi ? g : { ...g, items: g.items.filter((_, j) => j !== ii) })));
  }
  function addGroup() {
    setGroups((prev) => [...prev, { id: newId("group"), label: "", items: [] }]);
  }
  function removeGroup(gi: number) {
    setGroups((prev) => prev.filter((_, i) => i !== gi));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    const res = await updateReviewChecklistTemplate(groups);
    setSubmitting(false);
    if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="form-section" style={{ maxWidth: 600 }}>
      {groups.map((g, gi) => (
        <div key={g.id} className="map-card" style={{ padding: 16, marginBottom: 16, background: "var(--cream, var(--admin-panel))" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input className="field" style={{ margin: 0, fontWeight: 700 }} placeholder="Group name (e.g. Metadata)" value={g.label} onChange={(e) => updateGroupLabel(gi, e.target.value)} />
            <button type="button" className="btn btn-ghost btn-small" onClick={() => removeGroup(gi)}>Remove group</button>
          </div>
          {g.items.map((it, ii) => (
            <div key={it.id} style={{ display: "flex", gap: 8, marginBottom: 8, paddingLeft: 16 }}>
              <input className="field" style={{ margin: 0 }} placeholder="Checklist item" value={it.label} onChange={(e) => updateItemLabel(gi, ii, e.target.value)} />
              <button type="button" className="btn btn-ghost btn-small" onClick={() => removeItem(gi, ii)}>Remove</button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-small" style={{ marginLeft: 16 }} onClick={() => addItem(gi)}>+ Add item</button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost btn-small" onClick={addGroup}>+ Add group</button>

      {error && <div className="field-hint" style={{ color: "var(--coral-deep)", marginTop: 12 }}>{error}</div>}
      {saved && <div className="field-hint" style={{ color: "#1F6B48", marginTop: 12 }}>Saved.</div>}
      <div style={{ marginTop: 16 }}>
        <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
          {submitting ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
