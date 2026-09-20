"use client";

import { useState } from "react";
import { submitReview } from "@/actions/reviews";

export function LibraryReviewButton({ bookId, bookTitle }: { bookId: string; bookTitle: string }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [stars, setStars] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    const res = await submitReview({ bookId, content, stars });
    setSubmitting(false);
    if (res.ok) {
      setResult({ ok: true, message: "Thanks — your review is live." });
      setContent("");
    } else {
      setResult({ ok: false, message: res.error ?? "Something went wrong." });
    }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-ghost btn-small" onClick={() => { setOpen(true); setResult(null); }}>
        Write a review
      </button>
    );
  }

  return (
    <div className="map-card" style={{ padding: 14, minWidth: 260 }}>
      <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>Review &quot;{bookTitle}&quot;</div>
      <label className="field-label" htmlFor={`stars-${bookId}`}>Your rating</label>
      <select className="field" id={`stars-${bookId}`} value={stars} onChange={(e) => setStars(Number(e.target.value))} style={{ marginBottom: 8 }}>
        {[5, 4, 3, 2, 1].map((s) => <option key={s} value={s}>{"★".repeat(s)}{"☆".repeat(5 - s)}</option>)}
      </select>
      <textarea
        className="field"
        rows={3}
        placeholder="What did you think?"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        style={{ marginBottom: 8 }}
      />
      {result && (
        <p style={{ fontSize: 12, color: result.ok ? "#1F6B48" : "var(--coral-deep)", margin: "0 0 8px" }}>{result.message}</p>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn btn-primary btn-small" disabled={submitting || !content.trim()} onClick={handleSubmit}>
          {submitting ? "Submitting…" : "Submit review"}
        </button>
        <button type="button" className="btn btn-ghost btn-small" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
    </div>
  );
}
