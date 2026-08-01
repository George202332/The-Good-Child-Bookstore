"use client";

import { useState } from "react";
import { saveReviewChecklist } from "@/actions/admin";
import type { ChecklistGroup } from "@/lib/review-checklist";

export function ReviewChecklist({ bookId, groups, initial }: { bookId: string; groups: ChecklistGroup[]; initial: Record<string, boolean> }) {
  const [checked, setChecked] = useState<Record<string, boolean>>(initial ?? {});
  const [saving, setSaving] = useState(false);

  async function toggle(itemId: string) {
    const next = { ...checked, [itemId]: !checked[itemId] };
    setChecked(next);
    setSaving(true);
    await saveReviewChecklist(bookId, next);
    setSaving(false);
  }

  const totalItems = groups.reduce((s, g) => s + g.items.length, 0);
  const checkedCount = Object.values(checked).filter(Boolean).length;

  return (
    <div className="map-card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, margin: 0 }}>Review checklist</h3>
        <span style={{ fontSize: 11.5, color: "var(--ink-faint, var(--admin-text-faint))" }}>{checkedCount}/{totalItems}{saving ? " · saving…" : ""}</span>
      </div>
      {groups.map((g) => (
        <div key={g.id} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3px", color: "var(--ink-faint, var(--admin-text-faint))", marginBottom: 6 }}>{g.label}</div>
          {g.items.map((it) => (
            <label key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "5px 0", cursor: "pointer" }}>
              <input type="checkbox" checked={!!checked[it.id]} onChange={() => toggle(it.id)} />
              {it.label}
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}
