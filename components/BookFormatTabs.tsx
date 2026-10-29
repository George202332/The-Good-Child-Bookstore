"use client";

import { useState } from "react";
import Link from "next/link";
import type { FormatTabView, TabKey } from "@/lib/book-format-views";

const PREFLIGHT_LABEL: Record<string, string> = {
  PASSED: "Passed Lulu's print check",
  FAILED: "Failed the print check",
  CHECKING: "Print check running",
  UNAVAILABLE: "Print check could not finish",
};

const ADD_LABEL: Record<TabKey, string> = { ebook: "eBook", print: "Print", audiobook: "Audiobook" };

/** One book's formats as tabs: each tab shows that format's own status, price and
 * identifier; the Print tab also shows the Lulu pre-flight result. `addHref` (author view)
 * offers an easy way to add a missing format. */
export function BookFormatTabs({ tabs, missing, addHref }: { tabs: FormatTabView[]; missing?: TabKey[]; addHref?: string }) {
  const [active, setActive] = useState<TabKey>(tabs[0]?.key ?? "ebook");
  const current = tabs.find((t) => t.key === active) ?? tabs[0];
  if (!current) return null;
  return (
    <div style={{ marginTop: 8, minWidth: 240 }}>
      <div role="tablist" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={current.key === t.key}
            className={`btn btn-small ${current.key === t.key ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setActive(t.key)}>
            {t.label}
          </button>
        ))}
        {addHref && (missing ?? []).map((k) => (
          <Link key={k} href={addHref} className="btn btn-ghost btn-small" title={`Add the ${ADD_LABEL[k]} edition of this book`}>+ {ADD_LABEL[k]}</Link>
        ))}
      </div>
      <dl style={{ margin: 0, fontSize: 12.5, display: "grid", gridTemplateColumns: "auto 1fr", columnGap: 12, rowGap: 2 }}>
        <dt style={{ color: "var(--ink-faint)" }}>Status</dt>
        <dd style={{ margin: 0 }}>{current.status.replace(/_/g, " ").toLowerCase()}</dd>
        {current.details.map((d) => (
          <div key={d.label} style={{ display: "contents" }}>
            <dt style={{ color: "var(--ink-faint)" }}>{d.label}</dt>
            <dd style={{ margin: 0 }}>{d.value}</dd>
          </div>
        ))}
      </dl>
      {current.key === "print" && (
        <div style={{ marginTop: 6, fontSize: 12.5 }}>
          {current.preflight ? (
            <>
              <strong>{PREFLIGHT_LABEL[current.preflight.status]}</strong>
              {current.preflight.checkedAt ? <span style={{ color: "var(--ink-faint)" }}> · {new Date(current.preflight.checkedAt).toLocaleDateString("en-GB")}</span> : null}
              {current.preflight.reasons.length > 0 && (
                <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                  {current.preflight.reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              )}
            </>
          ) : (
            <span style={{ color: "var(--ink-faint)" }}>No print check saved yet.</span>
          )}
        </div>
      )}
    </div>
  );
}
