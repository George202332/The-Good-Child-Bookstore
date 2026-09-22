"use client";

import { useState } from "react";

const MAX_KEYWORDS = 7;

export function KeywordsField({
  keywords,
  onChange,
}: {
  keywords: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function commitDraft() {
    const value = draft.trim();
    if (!value || keywords.length >= MAX_KEYWORDS || keywords.includes(value)) return;
    onChange([...keywords, value]);
    setDraft("");
  }

  function removeAt(i: number) {
    onChange(keywords.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <label className="field-label">Keywords</label>
      <p className="field-hint" style={{ margin: "0 0 8px" }}>Up to 7, used to help readers and search find this book.</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        {keywords.map((kw, i) => (
          <span
            key={`${kw}-${i}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 10px",
              borderRadius: 999, background: "var(--cream)", border: "1px solid var(--line)",
              fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", width: "fit-content",
            }}
          >
            {kw}
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={`Remove ${kw}`}
              style={{ border: "none", background: "none", cursor: "pointer", color: "var(--ink-faint)", fontSize: 13, padding: 0, lineHeight: 1 }}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {keywords.length >= MAX_KEYWORDS ? (
        <p style={{ fontSize: 12.5, color: "#1F6B48", fontWeight: 600, margin: 0 }}>
          🎉 You&apos;ve reached the maximum of 7 keywords.
        </p>
      ) : (
        <input
          className="field"
          type="text"
          placeholder={`Type a keyword and press Enter (${keywords.length}/${MAX_KEYWORDS})`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commitDraft();
            }
          }}
          onBlur={commitDraft}
        />
      )}
    </div>
  );
}
