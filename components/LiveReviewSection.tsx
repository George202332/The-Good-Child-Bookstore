"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { getBookReviews, submitReview, type RealReview } from "@/actions/reviews";

/**
 * Real review submission, merged with the deterministic seed reviews from
 * lib/data/reviews.ts. Unlike the original's unreachable write-a-review
 * form (see app/book/[id]/page.tsx's top comment), this one is actually
 * wired to a button and persists to the database.
 */
export function LiveReviewSection({ bookId }: { bookId: string }) {
  const { data: session } = useSession();
  const [reviews, setReviews] = useState<RealReview[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState("");
  const [stars, setStars] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getBookReviews(bookId).then(setReviews);
  }, [bookId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await submitReview({ bookId, content, stars });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setContent("");
    setShowForm(false);
    getBookReviews(bookId).then(setReviews);
  }

  if (reviews.length === 0 && !session) return null;

  return (
    <div style={{ marginTop: 24 }}>
      {session?.user?.role === "READER" && (
        <div style={{ marginBottom: 16 }}>
          {!showForm ? (
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setShowForm(true)}>
              Write a review
            </button>
          ) : (
            <form onSubmit={handleSubmit} className="form-section" style={{ background: "var(--cream)" }}>
              <label className="field-label" htmlFor="review-stars">Your rating</label>
              <select className="field" id="review-stars" value={stars} onChange={(e) => setStars(Number(e.target.value))}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>{n} star{n === 1 ? "" : "s"}</option>
                ))}
              </select>
              <label className="field-label" htmlFor="review-text">Your review</label>
              <textarea className="field" id="review-text" rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
              {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
              <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit review"}
              </button>
            </form>
          )}
        </div>
      )}

      {reviews.length > 0 && (
        <>
          <h4 style={{ fontSize: 14, marginBottom: 10 }}>Reader reviews</h4>
          {reviews.map((r) => (
            <div className="review-card" key={r.id}>
              <div className="review-header">
                <div className="review-avatar" style={{ background: "var(--coral)" }}>
                  {r.name.split(" ").map((w) => w[0]).join("")}
                </div>
                <div className="review-name">{r.name}</div>
                <span className="review-stars">{"★".repeat(r.stars)}{"☆".repeat(5 - r.stars)}</span>
                <div className="review-date">{new Date(r.createdAt).toLocaleDateString()}</div>
              </div>
              <p className="review-text">{r.content}</p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
