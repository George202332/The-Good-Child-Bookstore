"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateHomepageContent } from "@/actions/cms";
import type { HomepageContent } from "@/lib/homepage-content";

export function HomepageEditor({ initial }: { initial: HomepageContent }) {
  const router = useRouter();
  const [content, setContent] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSaved(false);
    const res = await updateHomepageContent(content);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="form-section" style={{ background: "var(--cream)" }}>
      <label className="field-label" htmlFor="hero-eyebrow">Eyebrow text</label>
      <input
        className="field"
        id="hero-eyebrow"
        type="text"
        value={content.eyebrow}
        onChange={(e) => setContent((c) => ({ ...c, eyebrow: e.target.value }))}
      />
      <label className="field-label" htmlFor="hero-heading">Hero heading</label>
      <input
        className="field"
        id="hero-heading"
        type="text"
        value={content.heading}
        onChange={(e) => setContent((c) => ({ ...c, heading: e.target.value }))}
      />
      <label className="field-label" htmlFor="hero-lede">Hero description</label>
      <textarea
        className="field"
        id="hero-lede"
        rows={4}
        value={content.lede}
        onChange={(e) => setContent((c) => ({ ...c, lede: e.target.value }))}
      />
      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      {saved && <div className="field-hint" style={{ color: "#1F6B48" }}>Saved — live on the homepage now.</div>}
      <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
        {submitting ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
