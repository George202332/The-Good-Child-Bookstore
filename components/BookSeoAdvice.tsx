"use client";

import { bookSeoScore, type BookSeoInput } from "@/lib/seo/book-seo-score";

/** The book's SEO score and plain advice, inside the author's publishing checklist. It never blocks publishing. */
export function BookSeoAdvice(props: BookSeoInput) {
  const r = bookSeoScore(props);
  const colour = r.level === "good" ? "#1f8a4c" : r.level === "warn" ? "#b7791f" : "#c0392b";
  return (
    <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 10, border: "1px solid var(--line)" }} aria-live="polite">
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <strong style={{ fontSize: 22, color: colour }}>{r.score}</strong>
        <span style={{ fontWeight: 600 }}>SEO score for this book (out of 100)</span>
      </div>
      <div style={{ fontSize: 12.5, color: "var(--ink-soft)", margin: "2px 0 8px" }}>
        These notes help people find your book. They never stop you publishing, and a higher score does not guarantee any ranking.
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 4, fontSize: 13 }}>
        {r.checks.filter((c) => c.ok !== true).map((c) => <li key={c.id}>• <strong>{c.label}.</strong> {c.advice}</li>)}
        {r.checks.every((c) => c.ok === true) && <li>✓ Everything here is in good shape.</li>}
      </ul>
    </div>
  );
}
