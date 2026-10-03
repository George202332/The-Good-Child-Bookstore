"use client";

import { useState } from "react";
import type { HealthCategory } from "@/lib/site-health/checks";

const STATUS_LABEL: Record<string, string> = { ok: "Healthy", warning: "Warning", error: "Error" };

/** One expandable status card per Site Health category — collapsed by
 * default to keep the page scannable (per "a grid of status cards...
 * each expandable"), auto-expanded on first render for any category
 * that isn't fully healthy so an admin never has to click to find out
 * what's wrong. */
export function HealthCategoryCard({ category }: { category: HealthCategory }) {
  const [open, setOpen] = useState(category.status !== "ok");

  return (
    <div className={`health-card health-${category.status}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", background: "transparent", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
        aria-expanded={open}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span className={`health-dot health-${category.status}`} />
            <strong style={{ fontSize: 14.5 }}>{category.title}</strong>
          </div>
          <span className={`health-pill health-${category.status}`}>{STATUS_LABEL[category.status]}</span>
        </div>
        <p style={{ color: "var(--admin-text-faint)", fontSize: 12, margin: "8px 0 0" }}>{category.methodology}</p>
        <div style={{ color: "var(--admin-text-soft)", fontSize: 12, marginTop: 10 }}>{open ? "Hide details ▲" : "Show details ▼"}</div>
      </button>

      {open && (
        <div style={{ marginTop: 10 }}>
          {category.checks.map((check) => (
            <div key={check.id} className="health-check-row">
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span className={`health-dot health-${check.status}`} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{check.label}</span>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--admin-text-soft)", margin: "4px 0 0 17px" }}>{check.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
