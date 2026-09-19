"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { submitBook } from "@/actions/submissions";
import { checkManuscriptMetadata, type MetadataCheckResult } from "@/actions/metadata-check";
import { ImageUploadField } from "@/components/ImageUploadField";
import { FileUploadField } from "@/components/FileUploadField";
import { RichTextEditor } from "@/components/RichTextEditor";
import { SectionHeader, Card } from "./shared";
import { AuthorAliasField } from "./AuthorAliasField";
import { KeywordsField } from "./KeywordsField";
import { ManuscriptReviewViewer } from "@/components/ManuscriptReviewViewer";

const CATEGORIES = ["Picture books", "Bedtime stories", "Middle grade", "Educational"];
const GENRES = ["Adventure", "Fantasy", "Animal Story", "Fairy Tale", "Poetry", "Educational"];
const AGE_RANGES = ["0-2 years", "3-5 years", "6-8 years", "9-12 years", "12-15 years"];
const READING_LEVELS = ["Pre-reader", "Beginner", "Early Reader", "Independent Reader", "Fluent Reader"];
const LANGUAGES = ["English", "Spanish", "French", "Swahili"];
const LICENSE_TYPES = ["All rights reserved", "Exclusive Distribution", "Non-Exclusive Distribution"];
const TAX_SETTINGS = ["Calculate automatically by customer location", "Tax Exempt", "Fixed Rate"];

/** A 13-digit, all-numeric SN preview, matching the same shape the
 * server generates (see generateSerialNumber in actions/submissions.ts)
 * — always starts with 5. This is a client-side preview only; the
 * real, final SN is generated server-side at submission, but shown
 * here so the author sees a real example before they submit. */
function previewSerialNumber(): string {
  let digits = "5";
  for (let i = 0; i < 12; i++) digits += Math.floor(Math.random() * 10);
  return digits;
}

function plainTextFromHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function slugFromTitle(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/**
 * eBook submission — Files come first (manuscript + cover only），then
 * Book information, Author (a reusable name picker, not tied to the
 * account's real name), Book classification, Book description (long
 * description only) + Keywords, Pricing, Distribution, Rights, SEO
 * (fully derived, not author-editable), Preview, and the submission
 * checklist.
 */
export function EbookSubmissionForm() {
  const router = useRouter();

  // Files
  const [manuscriptFileId, setManuscriptFileId] = useState<string | undefined>();
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [previewStyle, setPreviewStyle] = useState<{ font: "serif" | "sans"; dropCap: "drop-cap" | "phrase-cap" | "none" }>({ font: "serif", dropCap: "drop-cap" });

  // Book information
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [edition, setEdition] = useState("");
  const [seriesName, setSeriesName] = useState("");
  const [seriesNumber, setSeriesNumber] = useState("");
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [publisher, setPublisher] = useState("The Good Child Bookstore");
  const [publicationDate, setPublicationDate] = useState("");
  const [originalPublicationDate, setOriginalPublicationDate] = useState("");
  const [isbn, setIsbn] = useState("");
  const [hasOwnIsbn, setHasOwnIsbn] = useState(false);
  const [generatedSn] = useState(previewSerialNumber);
  const [copyrightYear, setCopyrightYear] = useState(String(new Date().getFullYear()));

  // Author information
  const [authorFirstName, setAuthorFirstName] = useState("");
  const [authorLastName, setAuthorLastName] = useState("");
  const [authorBio, setAuthorBio] = useState("");

  // Book classification
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [genre, setGenre] = useState(GENRES[0]);
  const [ageGroup, setAgeGroup] = useState(AGE_RANGES[0]);
  const [readingLevel, setReadingLevel] = useState(READING_LEVELS[0]);

  // Book description
  const [descriptionHtml, setDescriptionHtml] = useState("");

  // Keywords
  const [keywords, setKeywords] = useState<string[]>([]);

  // Pricing
  const [price, setPrice] = useState("12.99");
  const [discountPrice, setDiscountPrice] = useState("");
  const [taxSetting, setTaxSetting] = useState(TAX_SETTINGS[0]);

  // Distribution
  const [sellOnStore, setSellOnStore] = useState(true);
  const [featuredRequest, setFeaturedRequest] = useState(false);
  const [affiliateEnabled, setAffiliateEnabled] = useState(false);

  // Rights
  const [worldwideRights, setWorldwideRights] = useState(true);
  const [countryRestrictions, setCountryRestrictions] = useState("");
  const [copyrightHolder, setCopyrightHolder] = useState("");
  const [licenseType, setLicenseType] = useState(LICENSE_TYPES[0]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // SEO — fully derived from what's already been filled in elsewhere,
  // never a separate author input. Kept aligned with the same
  // structure the rest of the site's SEO already uses (see
  // lib/seo/json-ld.ts and the per-page metadata pattern).
  const authorDisplayName = `${authorFirstName} ${authorLastName}`.trim();
  const seoTitle = title
    ? `${title}${authorDisplayName ? ` by ${authorDisplayName}` : ""} | The Good Child Bookstore`
    : "Your book title";
  const seoDescription = useMemo(() => {
    const plain = plainTextFromHtml(descriptionHtml);
    return plain.length > 160 ? `${plain.slice(0, 157)}…` : plain;
  }, [descriptionHtml]);
  const seoSlug = title ? slugFromTitle(title) : "…";

  const [metadataCheck, setMetadataCheck] = useState<MetadataCheckResult>({ titleFound: true, authorFound: true, checked: false });
  useEffect(() => {
    if (!manuscriptFileId || !title.trim()) return;
    const timer = setTimeout(() => {
      checkManuscriptMetadata(manuscriptFileId, title, `${authorFirstName} ${authorLastName}`.trim()).then(setMetadataCheck);
    }, 800);
    return () => clearTimeout(timer);
  }, [manuscriptFileId, title, authorFirstName, authorLastName]);

  const checklist = [
    { label: "Manuscript uploaded", ok: !!manuscriptFileId },
    { label: "Cover image uploaded", ok: !!coverImageUrl },
    { label: "Book title", ok: !!title.trim() },
    { label: "Author name", ok: !!authorFirstName.trim() && !!authorLastName.trim() },
    { label: "Category selected", ok: !!category },
    { label: "Age group selected", ok: !!ageGroup },
    { label: "Book description", ok: !!plainTextFromHtml(descriptionHtml) },
    { label: "List price set", ok: Number(price) > 0 },
    { label: "Copyright holder named", ok: !!copyrightHolder.trim() },
  ];
  const allChecksPass = checklist.every((c) => c.ok);
  const metadataMismatch = !!manuscriptFileId && !!title.trim() && metadataCheck.checked && (!metadataCheck.titleFound || !metadataCheck.authorFound);

  async function handleSubmit(submitForReview: boolean) {
    setSubmitting(true);
    setError(null);
    const res = await submitBook({
      title,
      subtitle,
      isbn: hasOwnIsbn ? isbn : generatedSn,
      description: plainTextFromHtml(descriptionHtml).slice(0, 500),
      price: Number(price) || 0,
      ageGroup,
      category,
      genre,
      language,
      coverImageUrl,
      manuscriptFileId,
      formats: { ebook: true, print: false, audiobook: false },
      metadata: {
        authorFirstName,
        authorLastName,
        edition,
        seriesName,
        seriesNumber: seriesNumber ? Number(seriesNumber) : undefined,
        publisher,
        publicationDate,
        originalPublicationDate,
        copyrightYear: copyrightYear ? Number(copyrightYear) : undefined,
        authorBio,
        readingLevel,
        longDescriptionHtml: descriptionHtml,
        discountPrice: discountPrice ? Number(discountPrice) : undefined,
        taxSetting,
        worldwideRights,
        countryRestrictions,
        copyrightHolder,
        licenseType,
        sellOnStore,
        featuredRequest,
        affiliateEnabled,
        seoTitle,
        seoDescription,
        keywords: keywords.join(", "),
      },
      submitForReview,
    });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    router.push("/account/books");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Section 1 — Files, first per explicit instruction */}
      <Card>
        <SectionHeader n={1} title="Files" sub="Manuscript and cover — this is where we start." />
        <div className="upload-cards-row">
          <FileUploadField
            label="Manuscript (PDF, EPUB, MOBI, or DOCX)"
            sizeHint="Max 4MB — a DOCX file is converted to PDF automatically"
            allowedTypes={["application/pdf", "application/epub+zip", "application/x-mobipocket-ebook", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]}
            accept=".pdf,.epub,.mobi,.docx"
            onUploaded={(ids) => setManuscriptFileId(ids[0])}
            fillWidth
          />
          <ImageUploadField label="Cover image" recommendedSize="Any image format — Recommended 1600×2400px" value={coverImageUrl} onChange={setCoverImageUrl} fillWidth />
        </div>
        <p className="field-hint" style={{ marginTop: 10 }}>
          Readers get a free preview of the first 10 pages from the &quot;Read sample&quot; button on the book&apos;s
          page — there&apos;s nothing separate to upload for that.
        </p>
      </Card>

      {/* Section 2 — Book information */}
      <Card>
        <SectionHeader n={2} title="Book information" sub="Core bibliographic details." />
        <label className="field-label" htmlFor="f-title">Book title</label>
        <input className="field" id="f-title" type="text" placeholder="Working title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="f-subtitle">Subtitle</label>
            <input className="field" id="f-subtitle" type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="f-edition">Edition</label>
            <input className="field" id="f-edition" type="text" placeholder="1st edition" value={edition} onChange={(e) => setEdition(e.target.value)} />
          </div>
        </div>
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="f-series">Series name</label>
            <input className="field" id="f-series" type="text" value={seriesName} onChange={(e) => setSeriesName(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="f-seriesnum">Series number</label>
            <input className="field" id="f-seriesnum" type="number" value={seriesNumber} onChange={(e) => setSeriesNumber(e.target.value)} />
          </div>
        </div>
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="f-lang">Language</label>
            <select className="field" id="f-lang" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="f-publisher">Publisher</label>
            <input className="field" id="f-publisher" type="text" value={publisher} onChange={(e) => setPublisher(e.target.value)} />
          </div>
        </div>
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="f-pubdate">Publication date</label>
            <input className="field" id="f-pubdate" type="date" value={publicationDate} onChange={(e) => setPublicationDate(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="f-origpubdate">Original publication date</label>
            <input className="field" id="f-origpubdate" type="date" value={originalPublicationDate} onChange={(e) => setOriginalPublicationDate(e.target.value)} />
            <div className="field-hint">Only if this is a reprint or new edition.</div>
          </div>
        </div>
        <div className="form-grid-2">
          <div>
            <label className="field-label">Book identifier</label>
            <div style={{ display: "flex", gap: 16, marginBottom: 8 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 400 }}>
                <input type="radio" name="isbn-mode" checked={!hasOwnIsbn} onChange={() => setHasOwnIsbn(false)} />
                Auto-generate an SN for me
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 400 }}>
                <input type="radio" name="isbn-mode" checked={hasOwnIsbn} onChange={() => setHasOwnIsbn(true)} />
                I have my own ISBN
              </label>
            </div>
            {hasOwnIsbn ? (
              <>
                <input className="field" id="f-isbn" type="text" placeholder="978-1-59299-541-7" value={isbn} onChange={(e) => setIsbn(e.target.value)} />
                <div className="field-hint">Enter your existing ISBN for this eBook.</div>
              </>
            ) : (
              <>
                <input className="field" type="text" value={generatedSn} readOnly disabled style={{ fontFamily: "monospace", letterSpacing: 1 }} />
                <div className="field-hint" style={{ margin: 0 }}>
                  Your SN — a 13-digit, all-numeric identifier starting with 5, distinct from a real ISBN.
                </div>
              </>
            )}
          </div>
          <div>
            <label className="field-label" htmlFor="f-copyrightyear">Copyright year</label>
            <input className="field" id="f-copyrightyear" type="number" value={copyrightYear} onChange={(e) => setCopyrightYear(e.target.value)} />
          </div>
        </div>
      </Card>

      {/* Section 3 — Author information */}
      <Card>
        <SectionHeader n={3} title="Author information" sub="Who's credited on this title." />
        <AuthorAliasField firstName={authorFirstName} lastName={authorLastName} onChange={(f, l) => { setAuthorFirstName(f); setAuthorLastName(l); }} />
        <label className="field-label" htmlFor="f-authorbio">Author bio</label>
        <textarea className="field" id="f-authorbio" rows={3} placeholder="A couple of sentences about you, for your author page" value={authorBio} onChange={(e) => setAuthorBio(e.target.value)} />
      </Card>

      {/* Section 4 — Book classification */}
      <Card>
        <SectionHeader n={4} title="Book classification" sub="How this title is categorized and shelved." />
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="f-category">Category</label>
            <select className="field" id="f-category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="f-genre">Genre</label>
            <select className="field" id="f-genre" value={genre} onChange={(e) => setGenre(e.target.value)}>
              {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
        </div>
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="f-age">Age group</label>
            <select className="field" id="f-age" value={ageGroup} onChange={(e) => setAgeGroup(e.target.value)}>
              {AGE_RANGES.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="f-readinglevel">Reading level</label>
            <select className="field" id="f-readinglevel" value={readingLevel} onChange={(e) => setReadingLevel(e.target.value)}>
              {READING_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
        </div>
      </Card>

      {/* Section 5 — Book description + Keywords */}
      <Card>
        <SectionHeader n={5} title="Book description" sub="The copy readers, teachers, and our editorial team will see." />
        <label className="field-label">Description</label>
        <RichTextEditor value={descriptionHtml} onChange={setDescriptionHtml} placeholder="Write a few paragraphs about the story…" maxWords={400} minHeight={250} />
        <div style={{ marginTop: 18 }}>
          <KeywordsField keywords={keywords} onChange={setKeywords} descriptionHtml={descriptionHtml} title={title} />
        </div>
      </Card>

      {/* Section 6 — Pricing */}
      <Card>
        <SectionHeader n={6} title="Pricing" sub="What readers pay, in US dollars — any currency conversion happens at checkout, outside this site." />
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="f-price">List price (USD)</label>
            <input className="field" id="f-price" type="number" step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="f-discountprice">Discount price (USD)</label>
            <input className="field" id="f-discountprice" type="number" step={0.01} value={discountPrice} onChange={(e) => setDiscountPrice(e.target.value)} />
          </div>
        </div>
        <label className="field-label" htmlFor="f-tax">Tax settings</label>
        <select className="field" id="f-tax" value={taxSetting} onChange={(e) => setTaxSetting(e.target.value)}>
          {TAX_SETTINGS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Card>

      {/* Section 7 — Distribution */}
      <Card>
        <SectionHeader n={7} title="Distribution" sub="Where and how this title can be found and sold." />
        <div className="toggle-row">
          <label className="toggle-switch"><input type="checkbox" checked={sellOnStore} onChange={(e) => setSellOnStore(e.target.checked)} /><span className="toggle-slider" /></label>
          <span>Sell on store</span>
        </div>
        <div className="toggle-row">
          <label className="toggle-switch"><input type="checkbox" checked={featuredRequest} onChange={(e) => setFeaturedRequest(e.target.checked)} /><span className="toggle-slider" /></label>
          <span>Request featured placement</span>
        </div>
        <div className="toggle-row">
          <label className="toggle-switch"><input type="checkbox" checked={affiliateEnabled} onChange={(e) => setAffiliateEnabled(e.target.checked)} /><span className="toggle-slider" /></label>
          <span>Enable this book for the affiliate program</span>
        </div>
        {affiliateEnabled && (
          <p className="field-hint" style={{ marginTop: 4 }}>
            Affiliates who sell this book will automatically earn 10% of the list price.
          </p>
        )}
      </Card>

      {/* Section 8 — Rights */}
      <Card>
        <SectionHeader n={8} title="Rights" sub="Ownership and licensing terms for this title." />
        <div className="toggle-row" style={{ marginBottom: 16 }}>
          <label className="toggle-switch"><input type="checkbox" checked={worldwideRights} onChange={(e) => setWorldwideRights(e.target.checked)} /><span className="toggle-slider" /></label>
          <span>Worldwide distribution rights</span>
        </div>
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="f-copyrightholder">Copyright holder</label>
            <input className="field" id="f-copyrightholder" type="text" value={copyrightHolder} onChange={(e) => setCopyrightHolder(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="f-license">License type</label>
            <select className="field" id="f-license" value={licenseType} onChange={(e) => setLicenseType(e.target.value)}>
              {LICENSE_TYPES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
        {!worldwideRights && (
          <>
            <label className="field-label" htmlFor="f-countryrestrict">Country restrictions</label>
            <input className="field" id="f-countryrestrict" type="text" placeholder="e.g. US, CA, UK" value={countryRestrictions} onChange={(e) => setCountryRestrictions(e.target.value)} />
          </>
        )}
      </Card>

      {/* Section 9 — SEO, fully derived, not author-editable */}
      <Card>
        <SectionHeader n={9} title="SEO" sub="Automatically built from what you've already filled in above — matches the SEO system used across the rest of the site." />
        <label className="field-label">SEO title</label>
        <div className="field" style={{ background: "var(--cream)", cursor: "default" }}>{seoTitle}</div>
        <label className="field-label">SEO description</label>
        <div className="field" style={{ background: "var(--cream)", cursor: "default", minHeight: 44 }}>{seoDescription || "Write a description above to see it here."}</div>
        <label className="field-label">Keywords</label>
        <div className="field" style={{ background: "var(--cream)", cursor: "default" }}>{keywords.length > 0 ? keywords.join(", ") : "Add keywords above to see them here."}</div>
        <label className="field-label">Search preview</label>
        <div className="search-preview">
          <div className="sp-url">thegoodchildbookstore.com › {seoSlug}</div>
          <div className="sp-title">{seoTitle}</div>
          <div className="sp-desc">{seoDescription || "Your SEO description will appear here."}</div>
        </div>
      </Card>

      {/* Section 10 — Preview */}
      <Card>
        <SectionHeader n={10} title="Preview" sub="How this title will look once it's live." />
        <div className="form-grid-2">
          <div>
            <label className="field-label">Cover preview</label>
            {coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- live preview of an uploaded cover
              <img src={coverImageUrl} alt="Cover preview" style={{ width: 140, borderRadius: 10, border: "1px solid var(--line)" }} />
            ) : (
              <div style={{ width: 140, height: 200, borderRadius: 10, border: "1px dashed var(--line)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--ink-faint)", textAlign: "center", padding: 8 }}>
                No cover uploaded yet
              </div>
            )}
            <p className="field-hint" style={{ marginTop: 8, maxWidth: 220 }}>
              Your cover is attached to the manuscript itself — readers who download this book will see it as the
              very first page.
            </p>
          </div>
          <div>
            <label className="field-label">Store listing preview</label>
            <div className="map-card" style={{ padding: 16 }}>
              <div style={{ fontWeight: 700 }}>{title || "Your book title"}</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>by {authorFirstName || authorLastName ? `${authorFirstName} ${authorLastName}`.trim() : "Author name"}</div>
              <div style={{ color: "var(--coral-deep)", fontWeight: 700, marginTop: 6 }}>${(Number(price) || 0).toFixed(2)}</div>
            </div>
          </div>
        </div>
        {manuscriptFileId ? (
          <div style={{ marginTop: 14 }}>
            <label className="field-label">Book preview</label>
            <p className="field-hint" style={{ margin: "0 0 10px" }}>
              Page by page, the same viewer our editors use during review. Your cover is attached to the
              manuscript itself, so it appears as the very first page here and in the final downloaded file.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "3fr 1fr", gap: 20, alignItems: "start" }}>
              <div style={{ height: 820, border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden" }}>
                <ManuscriptReviewViewer url={`/api/files/${manuscriptFileId}`} title={title || "Manuscript preview"} />
              </div>
              <div>
                <div style={{ background: "#1B1B3A", color: "#fff", borderRadius: "10px 10px 0 0", padding: "12px 16px", textAlign: "center", fontWeight: 700, fontSize: 14 }}>
                  Preview Style
                </div>
                <div className="map-card" style={{ padding: 16, borderRadius: "0 0 10px 10px", borderTop: "none", marginBottom: 20 }}>
                  <label className="field-label" htmlFor="f-previewfont">Font</label>
                  <select className="field" id="f-previewfont" value={previewStyle.font} onChange={(e) => setPreviewStyle((s) => ({ ...s, font: e.target.value as typeof previewStyle.font }))}>
                    <option value="serif">Serif</option>
                    <option value="sans">Sans-serif</option>
                  </select>
                  <label className="field-label" htmlFor="f-previewdropcap">Chapter start</label>
                  <select className="field" id="f-previewdropcap" value={previewStyle.dropCap} onChange={(e) => setPreviewStyle((s) => ({ ...s, dropCap: e.target.value as typeof previewStyle.dropCap }))}>
                    <option value="drop-cap">Drop cap</option>
                    <option value="phrase-cap">Phrase cap</option>
                    <option value="none">None</option>
                  </select>
                  <p className="field-hint" style={{ margin: 0 }}>Cosmetic reader-style preferences — doesn&apos;t change your actual uploaded file.</p>
                </div>

                <div style={{ background: "#1B1B3A", color: "#fff", borderRadius: "10px 10px 0 0", padding: "12px 16px", textAlign: "center", fontWeight: 700, fontSize: 14 }}>
                  Download Your Book Preview
                </div>
                <div style={{ border: "1px solid var(--line)", borderTop: "none", borderRadius: "0 0 10px 10px", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="map-card" style={{ padding: 12, textAlign: "center" }}>
                    <button type="button" className="btn btn-primary btn-small" style={{ width: "100%", marginBottom: 6 }} disabled>DOWNLOAD MOBI</button>
                    <p className="field-hint" style={{ margin: 0 }}>Not available — genuine MOBI conversion needs infrastructure this platform doesn&apos;t have yet.</p>
                  </div>
                  <div className="map-card" style={{ padding: 12, textAlign: "center" }}>
                    <a
                      href={`/api/convert/epub?fileId=${manuscriptFileId}&title=${encodeURIComponent(title)}&author=${encodeURIComponent(authorDisplayName)}`}
                      className="btn btn-primary btn-small"
                      style={{ width: "100%", marginBottom: 6, display: "block" }}
                    >
                      DOWNLOAD EPUB
                    </a>
                    <p className="field-hint" style={{ margin: 0 }}>Generated on the spot from your manuscript&apos;s text.</p>
                  </div>
                  <div className="map-card" style={{ padding: 12, textAlign: "center" }}>
                    <a href={`/api/files/${manuscriptFileId}`} target="_blank" rel="noreferrer" className="btn btn-primary btn-small" style={{ width: "100%", marginBottom: 6, display: "block" }}>DOWNLOAD PDF</a>
                    <p className="field-hint" style={{ margin: 0 }}>Available now — what readers get on purchase, cover included.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <p className="field-hint" style={{ marginTop: 14 }}>Upload a manuscript above to preview it page by page.</p>
        )}
      </Card>

      {/* Section 11 — Submission checklist */}
      <Card>
        <SectionHeader n={11} title="Submission checklist" sub="Everything below must be complete before submitting." />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {checklist.map((c) => (
            <div key={c.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: c.ok ? "#1F6B48" : "var(--coral-deep)" }}>
              {c.ok ? (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" /></svg>
              )}
              {c.label}{!c.ok && " — missing"}
            </div>
          ))}
        </div>
        {metadataMismatch && (
          <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 10, background: "#FDECEA", border: "1px solid #F3B6AE", fontSize: 13, color: "#8A2E1F" }}>
            ⚠ We checked the first couple of pages of your uploaded manuscript, and{" "}
            {!metadataCheck.titleFound && !metadataCheck.authorFound
              ? "neither the title nor the author name you entered could be found in it"
              : !metadataCheck.titleFound
              ? "the title you entered couldn't be found in it"
              : "the author name you entered couldn't be found in it"}
            . Please double check you&apos;ve uploaded the right file for this title.
          </div>
        )}
        {error && <div className="field-hint" style={{ color: "var(--coral-deep)", marginTop: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button type="button" className="btn btn-ghost btn-small" disabled={submitting} onClick={() => handleSubmit(false)}>
            Save as draft
          </button>
          <button type="button" className="btn btn-primary btn-small" disabled={submitting || !allChecksPass} onClick={() => handleSubmit(true)}>
            {submitting ? "Publishing…" : "Publish"}
          </button>
        </div>
      </Card>
    </div>
  );
}
