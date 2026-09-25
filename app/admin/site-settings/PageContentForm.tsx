"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updatePagesContent } from "@/actions/page-content";
import type { PagesContent } from "@/lib/page-content";
import { ImageUploadField } from "@/components/ImageUploadField";
import { MarketingPageEditor } from "./MarketingPageEditor";
import { LegalPageEditor } from "./LegalPageEditor";

type TabKey = "home" | "shop" | "authorship" | "affiliateMarketing" | "blog" | "contact" | "privacy" | "terms" | "returns" | "faq";

const TABS: { key: TabKey; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "shop", label: "Bookshelf" },
  { key: "authorship", label: "Authorship" },
  { key: "affiliateMarketing", label: "Affiliate" },
  { key: "blog", label: "Blog" },
  { key: "contact", label: "Contact Us" },
  { key: "privacy", label: "Privacy Policy" },
  { key: "terms", label: "Terms of Service" },
  { key: "returns", label: "Returns Policy" },
  { key: "faq", label: "FAQs" },
];

/** Every page that isn't Home or the two marketing/legal-edited pages
 * gets one simple heading field plus the single free-text editing
 * pane — the same one-pane-per-subtheme pattern used everywhere else. */
function SimplePageEditor({
  headingLabel,
  heading,
  bodyHtml,
  onHeadingChange,
  onBodyChange,
}: {
  headingLabel: string;
  heading: string;
  bodyHtml: string;
  onHeadingChange: (v: string) => void;
  onBodyChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="field-label">{headingLabel}</label>
      <input className="field" type="text" value={heading} onChange={(e) => onHeadingChange(e.target.value)} />
      <label className="field-label" style={{ marginTop: 10 }}>Content</label>
      <textarea
        className="field"
        rows={18}
        style={{ maxWidth: 1280, fontFamily: "monospace", fontSize: 13 }}
        value={bodyHtml}
        onChange={(e) => onBodyChange(e.target.value)}
        placeholder="Write or paste the full page content here. Basic HTML tags (<h3>, <p>, <ul>, <li>, <a>, <strong>) are supported."
      />
    </div>
  );
}

export function PageContentForm({ initial }: { initial: PagesContent }) {
  const router = useRouter();
  const [content, setContent] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("home");

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
        Each page below has one editing pane where its content is written or pasted in as a single block. Authorship
        and Affiliate additionally keep their own banner (image + heading + intro text) at the top, unchanged.
      </p>

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        background: "var(--cream)", borderRadius: 10, padding: "10px 14px", marginBottom: 16,
      }}>
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>
          This button saves the page content below (all tabs) — it&apos;s separate from the branding form above.
        </span>
        <button type="submit" className="btn btn-primary btn-small" disabled={submitting} style={{ flexShrink: 0 }}>
          {submitting ? "Saving…" : "Save page content"}
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20, borderBottom: "1px solid var(--line)", paddingBottom: 12 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`btn btn-small ${activeTab === t.key ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "home" && (
        <div>
          <label className="field-label" htmlFor="home-eyebrow">Eyebrow text</label>
          <input className="field" id="home-eyebrow" type="text" value={content.home.eyebrow} onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, eyebrow: e.target.value } }))} />
          <label className="field-label" htmlFor="home-heading">Hero heading</label>
          <input className="field" id="home-heading" type="text" value={content.home.heading} onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, heading: e.target.value } }))} />
          <label className="field-label" htmlFor="home-lede">Hero description</label>
          <textarea className="field" id="home-lede" rows={3} value={content.home.lede} onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, lede: e.target.value } }))} />
          <label className="field-label" style={{ marginTop: 10 }}>Hero banner images (one per slide)</label>
          <div className="upload-cards-row">
            <ImageUploadField label="Slide 1: Welcome" recommendedSize="Recommended 1200×600px" value={content.home.heroWelcomeImage} onChange={(url) => setContent((c) => ({ ...c, home: { ...c.home, heroWelcomeImage: url } }))} />
            <ImageUploadField label="Slide 2: Browse the bookshelf" recommendedSize="Recommended 1200×600px" value={content.home.heroBrowseImage} onChange={(url) => setContent((c) => ({ ...c, home: { ...c.home, heroBrowseImage: url } }))} />
            <ImageUploadField label="Slide 3: Become an author" recommendedSize="Recommended 1200×600px" value={content.home.heroAuthorImage} onChange={(url) => setContent((c) => ({ ...c, home: { ...c.home, heroAuthorImage: url } }))} />
            <ImageUploadField label="Slide 4: Become an affiliate" recommendedSize="Recommended 1200×600px" value={content.home.heroAffiliateImage} onChange={(url) => setContent((c) => ({ ...c, home: { ...c.home, heroAffiliateImage: url } }))} />
          </div>

          <div style={{ marginTop: 10 }}>
            <label className="field-label" htmlFor="banner-bookclub-title">Book Club banner title</label>
            <input className="field" id="banner-bookclub-title" type="text" value={content.home.bookClubBannerTitle} onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, bookClubBannerTitle: e.target.value } }))} />
            <label className="field-label" htmlFor="banner-bookclub-body">Book Club banner text</label>
            <textarea className="field" id="banner-bookclub-body" rows={2} value={content.home.bookClubBannerBody} onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, bookClubBannerBody: e.target.value } }))} />

            <label className="field-label" htmlFor="banner-print-title">Print banner title</label>
            <input className="field" id="banner-print-title" type="text" value={content.home.printBannerTitle} onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, printBannerTitle: e.target.value } }))} />
            <label className="field-label" htmlFor="banner-print-body">Print banner text</label>
            <textarea className="field" id="banner-print-body" rows={2} value={content.home.printBannerBody} onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, printBannerBody: e.target.value } }))} />

            <label className="field-label" htmlFor="banner-affiliate-title">Affiliate banner title</label>
            <input className="field" id="banner-affiliate-title" type="text" value={content.home.affiliateBannerTitle} onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, affiliateBannerTitle: e.target.value } }))} />
            <label className="field-label" htmlFor="banner-affiliate-body">Affiliate banner text</label>
            <textarea className="field" id="banner-affiliate-body" rows={2} value={content.home.affiliateBannerBody} onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, affiliateBannerBody: e.target.value } }))} />

            <label className="field-label" htmlFor="banner-journal-title">Journal banner title</label>
            <input className="field" id="banner-journal-title" type="text" value={content.home.journalBannerTitle} onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, journalBannerTitle: e.target.value } }))} />
            <label className="field-label" htmlFor="banner-journal-body">Journal banner text</label>
            <textarea className="field" id="banner-journal-body" rows={2} value={content.home.journalBannerBody} onChange={(e) => setContent((c) => ({ ...c, home: { ...c.home, journalBannerBody: e.target.value } }))} />

            <label className="field-label" style={{ marginTop: 4 }}>Banner images</label>
            <div className="upload-cards-row">
              <ImageUploadField label="Book Club banner image" recommendedSize="Recommended 1200×600px" value={content.home.bookClubBannerImage} onChange={(url) => setContent((c) => ({ ...c, home: { ...c.home, bookClubBannerImage: url } }))} />
              <ImageUploadField label="Print banner image" recommendedSize="Recommended 1200×600px" value={content.home.printBannerImage} onChange={(url) => setContent((c) => ({ ...c, home: { ...c.home, printBannerImage: url } }))} />
              <ImageUploadField label="Affiliate banner image" recommendedSize="Recommended 1200×600px" value={content.home.affiliateBannerImage} onChange={(url) => setContent((c) => ({ ...c, home: { ...c.home, affiliateBannerImage: url } }))} />
              <ImageUploadField label="Journal banner image" recommendedSize="Recommended 1200×600px" value={content.home.journalBannerImage} onChange={(url) => setContent((c) => ({ ...c, home: { ...c.home, journalBannerImage: url } }))} />
            </div>
          </div>
        </div>
      )}

      {activeTab === "shop" && (
        <SimplePageEditor
          headingLabel="Heading"
          heading={content.shop.heading}
          bodyHtml={content.shop.bodyHtml}
          onHeadingChange={(v) => setContent((c) => ({ ...c, shop: { ...c.shop, heading: v } }))}
          onBodyChange={(v) => setContent((c) => ({ ...c, shop: { ...c.shop, bodyHtml: v } }))}
        />
      )}

      {activeTab === "authorship" && (
        <MarketingPageEditor label="Authorship page" value={content.authorship} onChange={(next) => setContent((c) => ({ ...c, authorship: next }))} />
      )}

      {activeTab === "affiliateMarketing" && (
        <MarketingPageEditor label="Affiliate page" value={content.affiliateMarketing} onChange={(next) => setContent((c) => ({ ...c, affiliateMarketing: next }))} />
      )}

      {activeTab === "blog" && (
        <SimplePageEditor
          headingLabel="Heading"
          heading={content.blog.heading}
          bodyHtml={content.blog.bodyHtml}
          onHeadingChange={(v) => setContent((c) => ({ ...c, blog: { ...c.blog, heading: v } }))}
          onBodyChange={(v) => setContent((c) => ({ ...c, blog: { ...c.blog, bodyHtml: v } }))}
        />
      )}

      {activeTab === "contact" && (
        <SimplePageEditor
          headingLabel="Heading"
          heading={content.contact.heading}
          bodyHtml={content.contact.bodyHtml}
          onHeadingChange={(v) => setContent((c) => ({ ...c, contact: { ...c.contact, heading: v } }))}
          onBodyChange={(v) => setContent((c) => ({ ...c, contact: { ...c.contact, bodyHtml: v } }))}
        />
      )}

      {activeTab === "privacy" && (
        <LegalPageEditor label="Privacy Policy" value={content.privacy} onChange={(next) => setContent((c) => ({ ...c, privacy: next }))} />
      )}
      {activeTab === "terms" && (
        <LegalPageEditor label="Terms of Service" value={content.terms} onChange={(next) => setContent((c) => ({ ...c, terms: next }))} />
      )}
      {activeTab === "returns" && (
        <LegalPageEditor label="Return Policy" value={content.returns} onChange={(next) => setContent((c) => ({ ...c, returns: next }))} />
      )}
      {activeTab === "faq" && (
        <LegalPageEditor label="FAQs" value={content.faq} onChange={(next) => setContent((c) => ({ ...c, faq: next }))} />
      )}

      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      {saved && <div className="field-hint" style={{ color: "#1F6B48" }}>Saved — live on the site now.</div>}
      <button type="submit" className="btn btn-primary btn-small" style={{ marginTop: 16 }} disabled={submitting}>
        {submitting ? "Saving…" : "Save page content"}
      </button>
    </form>
  );
}
