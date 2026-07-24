"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { submitBlogComment, type PublicBlogComment } from "@/actions/blog-comments";

export function BlogCommentSection({ blogId, initial }: { blogId: string; initial: PublicBlogComment[] }) {
  const { data: session } = useSession();
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await submitBlogComment(blogId, comment);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setComment("");
    router.refresh();
  }

  return (
    <div style={{ marginTop: 40, borderTop: "1px solid var(--line)", paddingTop: 28 }}>
      <h3 style={{ fontSize: 17, marginBottom: 16 }}>Comments {initial.length > 0 && `(${initial.length})`}</h3>

      {session?.user ? (
        <form onSubmit={handleSubmit} style={{ marginBottom: 24 }}>
          <textarea
            className="field"
            rows={3}
            placeholder="Share your thoughts…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            required
          />
          {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
          <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
            {submitting ? "Posting…" : "Post comment"}
          </button>
        </form>
      ) : (
        <p style={{ fontSize: 13.5, color: "var(--ink-faint)", marginBottom: 24 }}>Sign in to leave a comment.</p>
      )}

      {initial.length === 0 ? (
        <p style={{ fontSize: 13.5, color: "var(--ink-faint)" }}>No comments yet — be the first to share your thoughts.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {initial.map((c) => (
            <div key={c.id}>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>{c.commenterName}</div>
              <div style={{ fontSize: 12, color: "var(--ink-faint)", marginBottom: 4 }}>
                {new Date(c.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.6 }}>{c.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
