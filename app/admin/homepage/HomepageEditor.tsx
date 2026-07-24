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

      <h3 style={{ fontSize: 15, margin: "20px 0 10px" }}>Promo banners</h3>

      <label className="field-label" htmlFor="banner-bookclub-title">Book Club banner title</label>
      <input className="field" id="banner-bookclub-title" type="text" value={content.bookClubBannerTitle} onChange={(e) => setContent((c) => ({ ...c, bookClubBannerTitle: e.target.value }))} />
      <label className="field-label" htmlFor="banner-bookclub-body">Book Club banner text</label>
      <textarea className="field" id="banner-bookclub-body" rows={2} value={content.bookClubBannerBody} onChange={(e) => setContent((c) => ({ ...c, bookClubBannerBody: e.target.value }))} />

      <label className="field-label" htmlFor="banner-print-title">Print banner title</label>
      <input className="field" id="banner-print-title" type="text" value={content.printBannerTitle} onChange={(e) => setContent((c) => ({ ...c, printBannerTitle: e.target.value }))} />
      <label className="field-label" htmlFor="banner-print-body">Print banner text</label>
      <textarea className="field" id="banner-print-body" rows={2} value={content.printBannerBody} onChange={(e) => setContent((c) => ({ ...c, printBannerBody: e.target.value }))} />

      <label className="field-label" htmlFor="banner-affiliate-title">Affiliate banner title</label>
      <input className="field" id="banner-affiliate-title" type="text" value={content.affiliateBannerTitle} onChange={(e) => setContent((c) => ({ ...c, affiliateBannerTitle: e.target.value }))} />
      <label className="field-label" htmlFor="banner-affiliate-body">Affiliate banner text</label>
      <textarea className="field" id="banner-affiliate-body" rows={2} value={content.affiliateBannerBody} onChange={(e) => setContent((c) => ({ ...c, affiliateBannerBody: e.target.value }))} />

      <label className="field-label" htmlFor="banner-journal-title">Journal banner title</label>
      <input className="field" id="banner-journal-title" type="text" value={content.journalBannerTitle} onChange={(e) => setContent((c) => ({ ...c, journalBannerTitle: e.target.value }))} />
      <label className="field-label" htmlFor="banner-journal-body">Journal banner text</label>
      <textarea className="field" id="banner-journal-body" rows={2} value={content.journalBannerBody} onChange={(e) => setContent((c) => ({ ...c, journalBannerBody: e.target.value }))} />

      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      {saved && <div className="field-hint" style={{ color: "#1F6B48" }}>Saved — live on the homepage now.</div>}
      <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
        {submitting ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
