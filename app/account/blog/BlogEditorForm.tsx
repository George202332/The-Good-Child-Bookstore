"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveBlogPost } from "@/actions/blog";

export function BlogEditorForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSave(submitForReview: boolean) {
    setSubmitting(true);
    setError(null);
    const res = await saveBlogPost({ title, content, submitForReview });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setTitle("");
    setContent("");
    router.refresh();
  }

  return (
    <div className="form-section" style={{ background: "var(--cream)" }}>
      <label className="field-label" htmlFor="blog-title">Title</label>
      <input className="field" id="blog-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
      <label className="field-label" htmlFor="blog-content">Content</label>
      <textarea className="field" id="blog-content" rows={8} value={content} onChange={(e) => setContent(e.target.value)} />
      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <button type="button" className="btn btn-ghost btn-small" disabled={submitting} onClick={() => handleSave(false)}>
          Save draft
        </button>
        <button type="button" className="btn btn-primary btn-small" disabled={submitting} onClick={() => handleSave(true)}>
          Submit for review
        </button>
      </div>
    </div>
  );
}
