"use client";

import { useEffect, useRef, useState } from "react";
import { extractSuggestedKeywords } from "./keyword-suggestions";

const MAX_KEYWORDS = 7;

export function KeywordsField({
  keywords,
  onChange,
  descriptionHtml = "",
  title = "",
}: {
  keywords: string[];
  onChange: (next: string[]) => void;
  /** Plain description HTML and book title — used only to seed
   * suggestions when automatic generation is turned on; never sent
   * anywhere, purely a local heuristic (see keyword-suggestions.ts). */
  descriptionHtml?: string;
  title?: string;
}) {
  const [draft, setDraft] = useState("");
  const [autoGenerate, setAutoGenerate] = useState(false);
  // Tracks whether the *current* set of keywords was produced by
  // auto-generation, so re-running it after further edits to the
  // description doesn't clobber keywords the author typed by hand.
  const lastAutoSourceRef = useRef<string>("");

  useEffect(() => {
    if (!autoGenerate) return;
    const plain = descriptionHtml.replace(/<[^>]+>/g, " ").trim();
    if (!plain || plain === lastAutoSourceRef.current) return;
    const timer = setTimeout(() => {
      const suggested = extractSuggestedKeywords(descriptionHtml, title, MAX_KEYWORDS);
      lastAutoSourceRef.current = plain;
      if (suggested.length > 0) onChange(suggested);
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onChange is a setState setter, stable identity not required
  }, [autoGenerate, descriptionHtml, title]);

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

      <div className="toggle-row" style={{ marginBottom: 10 }}>
        <label className="toggle-switch">
          <input
            type="checkbox"
            checked={autoGenerate}
            onChange={(e) => {
              setAutoGenerate(e.target.checked);
              if (e.target.checked) lastAutoSourceRef.current = ""; // force a fresh generation on toggle-on
            }}
          />
          <span className="toggle-slider" />
        </label>
        <span>Automatically generate keywords from the book description</span>
      </div>
      {autoGenerate && (
        <p className="field-hint" style={{ margin: "0 0 8px" }}>
          Suggested from your description below — feel free to edit, add, or remove any of them.
        </p>
      )}

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
