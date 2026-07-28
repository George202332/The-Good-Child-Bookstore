"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveBlogPost, updateBlogPost } from "@/actions/blog";
import { ImageUploadField } from "@/components/ImageUploadField";

export interface EditingBlogPost {
  id: string;
  title: string;
  content: string;
  coverImageUrl: string | null;
}

/**
 * The blog write/edit form — matches writeBlogHTML's real fields (title,
 * cover image, content) from the original, backed by the site's real
 * Draft → Pending Review → Published editorial workflow. Handles both
 * creating a new post and editing an existing draft/rejected one
 * (editingPost prop) — the actual save call and button labels adjust
 * accordingly, and onDone lets the parent tab switch back to the list.
 */
export function BlogEditorForm({ editingPost, onDone }: { editingPost?: EditingBlogPost; onDone?: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(editingPost?.title ?? "");
  const [content, setContent] = useState(editingPost?.content ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(editingPost?.coverImageUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSave(submitForReview: boolean) {
    setSubmitting(true);
    setError(null);
    const res = editingPost
      ? await updateBlogPost(editingPost.id, { title, content, coverImageUrl, submitForReview })
      : await saveBlogPost({ title, content, coverImageUrl, submitForReview });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    if (!editingPost) {
      setTitle("");
      setContent("");
      setCoverImageUrl("");
    }
    router.refresh();
    onDone?.();
  }

  return (
    <div className="form-section" style={{ background: "var(--cream)" }}>
      <label className="field-label" htmlFor="blog-title">Title</label>
      <input className="field" id="blog-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
      <label className="field-label" style={{ marginTop: 14 }}>Cover image (optional)</label>
      <ImageUploadField
        label="Cover image"
        recommendedSize="Any image format — automatically converted to WebP"
        value={coverImageUrl}
        onChange={setCoverImageUrl}
      />
      <label className="field-label" htmlFor="blog-content" style={{ marginTop: 14 }}>Content</label>
      <textarea className="field" id="blog-content" rows={12} value={content} onChange={(e) => setContent(e.target.value)} />
      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <button type="button" className="btn btn-ghost btn-small" disabled={submitting} onClick={() => handleSave(false)}>
          Save draft
        </button>
        <button type="button" className="btn btn-primary btn-small" disabled={submitting} onClick={() => handleSave(true)}>
          Submit for review
        </button>
        {onDone && (
          <button type="button" className="btn btn-ghost btn-small" disabled={submitting} onClick={onDone}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
