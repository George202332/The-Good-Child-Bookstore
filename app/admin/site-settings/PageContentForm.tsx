"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePagesContent } from "@/actions/page-content";
import type { PagesContent } from "@/lib/page-content";
import { ImageUploadField } from "@/components/ImageUploadField";

const PAGE_LABELS: { key: keyof Omit<PagesContent, "home">; label: string }[] = [
  { key: "shop", label: "Bookshelf" },
  { key: "authors", label: "Authorship" },
  { key: "affiliate", label: "Affiliate" },
  { key: "blog", label: "Blog" },
  { key: "contact", label: "Contact Us" },
];

export function PageContentForm({ initial }: { initial: PagesContent }) {
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
    const res = await updatePagesContent(content);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="form-section">
      <p style={{ fontSize: 12.5, color: "var(--ink-faint)", marginBottom: 16 }}>
        This covers the intro text visitors see first on each page. The longer, detailed sections further down
        each page (like Authorship&apos;s and Affiliate&apos;s feature walkthroughs) aren&apos;t individually
        editable yet — that would need a larger content-block editor, which is a bigger separate build.
      </p>

      <h3 style={{ fontSize: 15, marginBottom: 10 }}>Home</h3>
      <label className="field-label" htmlFor="home-eyebrow">Eyebrow text</label>
      <input className="field" id="home-eyebrow" type="text" value={content.home.eyebrow} onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, eyebrow: e.target.value } }))} />
      <label className="field-label" htmlFor="home-heading">Hero heading</label>
      <input className="field" id="home-heading" type="text" value={content.home.heading} onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, heading: e.target.value } }))} />
      <label className="field-label" htmlFor="home-lede">Hero description</label>
      <textarea className="field" id="home-lede" rows={3} value={content.home.lede} onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, lede: e.target.value } }))} />
      <ImageUploadField
        label="Hero banner background image"
        recommendedSize="Recommended 1600×600px (landscape) — shared behind all 4 hero slides"
        value={content.home.heroImage}
        onChange={(url) => setContent((c) => ({ ...c, home: { ...c.home, heroImage: url } }))}
      />

      <div style={{ marginTop: 10 }}>
        <label className="field-label" htmlFor="banner-bookclub-title">Book Club banner title</label>
        <input className="field" id="banner-bookclub-title" type="text" value={content.home.bookClubBannerTitle} onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, bookClubBannerTitle: e.target.value } }))} />
        <label className="field-label" htmlFor="banner-bookclub-body">Book Club banner text</label>
        <textarea className="field" id="banner-bookclub-body" rows={2} value={content.home.bookClubBannerBody} onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, bookClubBannerBody: e.target.value } }))} />
        <ImageUploadField
          label="Book Club banner image"
          recommendedSize="Recommended 1200×500px"
          value={content.home.bookClubBannerImage}
          onChange={(url) => setContent((c) => ({ ...c, home: { ...c.home, bookClubBannerImage: url } }))}
        />

        <label className="field-label" htmlFor="banner-print-title">Print banner title</label>
        <input className="field" id="banner-print-title" type="text" value={content.home.printBannerTitle} onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, printBannerTitle: e.target.value } }))} />
        <label className="field-label" htmlFor="banner-print-body">Print banner text</label>
        <textarea className="field" id="banner-print-body" rows={2} value={content.home.printBannerBody} onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, printBannerBody: e.target.value } }))} />
        <ImageUploadField
          label="Print banner image"
          recommendedSize="Recommended 1200×500px"
          value={content.home.printBannerImage}
          onChange={(url) => setContent((c) => ({ ...c, home: { ...c.home, printBannerImage: url } }))}
        />

        <label className="field-label" htmlFor="banner-affiliate-title">Affiliate banner title</label>
        <input className="field" id="banner-affiliate-title" type="text" value={content.home.affiliateBannerTitle} onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, affiliateBannerTitle: e.target.value } }))} />
        <label className="field-label" htmlFor="banner-affiliate-body">Affiliate banner text</label>
        <textarea className="field" id="banner-affiliate-body" rows={2} value={content.home.affiliateBannerBody} onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, affiliateBannerBody: e.target.value } }))} />
        <ImageUploadField
          label="Affiliate banner image"
          recommendedSize="Recommended 1200×500px"
          value={content.home.affiliateBannerImage}
          onChange={(url) => setContent((c) => ({ ...c, home: { ...c.home, affiliateBannerImage: url } }))}
        />

        <label className="field-label" htmlFor="banner-journal-title">Journal banner title</label>
        <input className="field" id="banner-journal-title" type="text" value={content.home.journalBannerTitle} onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, journalBannerTitle: e.target.value } }))} />
        <label className="field-label" htmlFor="banner-journal-body">Journal banner text</label>
        <textarea className="field" id="banner-journal-body" rows={2} value={content.home.journalBannerBody} onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, journalBannerBody: e.target.value } }))} />
        <ImageUploadField
          label="Journal banner image"
          recommendedSize="Recommended 1200×500px"
          value={content.home.journalBannerImage}
          onChange={(url) => setContent((c) => ({ ...c, home: { ...c.home, journalBannerImage: url } }))}
        />
      </div>

      {PAGE_LABELS.map(({ key, label }) => (
        <div key={key}>
          <h3 style={{ fontSize: 15, margin: "20px 0 10px" }}>{label}</h3>
          <label className="field-label" htmlFor={`${key}-eyebrow`}>Eyebrow text</label>
          <input
            className="field"
            id={`${key}-eyebrow`}
            type="text"
            value={content[key].eyebrow}
            onChange={(e) => setContent((c) => ({ ...c, [key]: { ...c[key], eyebrow: e.target.value } }))}
          />
          <label className="field-label" htmlFor={`${key}-heading`}>Heading</label>
          <input
            className="field"
            id={`${key}-heading`}
            type="text"
            value={content[key].heading}
            onChange={(e) => setContent((c) => ({ ...c, [key]: { ...c[key], heading: e.target.value } }))}
          />
          <label className="field-label" htmlFor={`${key}-intro`}>Intro text</label>
          <textarea
            className="field"
            id={`${key}-intro`}
            rows={3}
            value={content[key].introText}
            onChange={(e) => setContent((c) => ({ ...c, [key]: { ...c[key], introText: e.target.value } }))}
          />
        </div>
      ))}

      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      {saved && <div className="field-hint" style={{ color: "#1F6B48" }}>Saved — live on the site now.</div>}
      <button type="submit" className="btn btn-primary btn-small" disabled={submitting}>
        {submitting ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
