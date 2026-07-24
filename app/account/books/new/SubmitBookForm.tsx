"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitBook } from "@/actions/submissions";
import { ImageUploadField } from "@/components/ImageUploadField";
import { FileUploadField } from "@/components/FileUploadField";
import { RichTextEditor } from "@/components/RichTextEditor";
import { LULU_CONFIG, buildPodPackageId } from "@/lib/lulu-config";

const AGE_RANGES = ["0-2 years", "3-5 years", "6-8 years", "9-12 years", "12-15 years"];
const CATEGORIES = ["Picture books", "Bedtime stories", "Middle grade", "Educational"];
const GENRES = ["Adventure", "Fantasy", "Animal Story", "Fairy Tale", "Poetry", "Educational"];
const READING_LEVELS = ["Pre-reader", "Beginner", "Early Reader", "Independent Reader", "Fluent Reader"];
const SCHOOL_GRADES = ["Pre-K", "Kindergarten", "1st Grade", "2nd Grade", "3rd Grade", "4th-6th Grade"];
const LANGUAGES = ["English", "Spanish", "French", "Swahili"];
const LICENSE_TYPES = ["All rights reserved", "Exclusive Distribution", "Non-Exclusive Distribution"];
const CURRENCIES = ["USD", "EUR", "GBP"];
const TAX_SETTINGS = ["Calculate automatically by customer location", "Tax Exempt", "Fixed Rate"];
const FILE_FORMATS = ["EPUB", "PDF", "MOBI"];
const MARKETPLACES: { key: "amazon" | "appleBooks" | "google" | "barnesNoble" | "kobo" | "overdrive"; label: string }[] = [
  { key: "amazon", label: "Amazon" },
  { key: "appleBooks", label: "Apple Books" },
  { key: "google", label: "Google" },
  { key: "barnesNoble", label: "Barnes and Noble" },
  { key: "kobo", label: "Kobo" },
  { key: "overdrive", label: "Overdrive" },
];

function SectionHeader({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 16 }}>
      <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--coral)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13.5, flexShrink: 0 }}>
        {n}
      </div>
      <div>
        <h3 style={{ fontSize: 16, marginBottom: 2 }}>{title}</h3>
        <p style={{ fontSize: 13, color: "var(--ink-soft)", margin: 0 }}>{sub}</p>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="form-section" style={{ maxWidth: 900 }}>{children}</div>;
}

/**
 * Converted to match the exact reference design provided: 11 numbered
 * sections (Book information, Author information, Book classification,
 * Book description, Files, Pricing, Distribution, Rights, SEO, Preview,
 * Submission checklist), a rich-text long description editor, real
 * file-upload cards, live cover/listing preview, and a live submission
 * checklist gating the Publish button. This is the eBook tab in full
 * detail; Print/Audiobook tabs reuse the shared fields and only differ
 * in their format-specific section.
 */
export function SubmitBookForm() {
  const router = useRouter();
  const [activeFormat, setActiveFormat] = useState<"ebook" | "print" | "audiobook">("ebook");

  // Section 1
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
  const [copyrightYear, setCopyrightYear] = useState(String(new Date().getFullYear()));

  // Section 2
  const [authorFirstName, setAuthorFirstName] = useState("");
  const [authorLastName, setAuthorLastName] = useState("");
  const [coAuthors, setCoAuthors] = useState("");
  const [illustrator, setIllustrator] = useState("");
  const [editor, setEditor] = useState("");
  const [translator, setTranslator] = useState("");
  const [authorBio, setAuthorBio] = useState("");

  // Section 3
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [genre, setGenre] = useState(GENRES[0]);
  const [subgenre, setSubgenre] = useState("");
  const [ageGroup, setAgeGroup] = useState(AGE_RANGES[0]);
  const [readingLevel, setReadingLevel] = useState(READING_LEVELS[0]);
  const [schoolGrade, setSchoolGrade] = useState(SCHOOL_GRADES[0]);
  const [curriculum, setCurriculum] = useState("");

  // Section 4
  const [shortDescription, setShortDescription] = useState("");
  const [longDescriptionHtml, setLongDescriptionHtml] = useState("");
  const [backCoverDescription, setBackCoverDescription] = useState("");
  const [learningObjectives, setLearningObjectives] = useState("");
  const [educationalBenefits, setEducationalBenefits] = useState("");

  // Section 5
  const [manuscriptFileId, setManuscriptFileId] = useState<string | undefined>();
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [samplePagesFileId, setSamplePagesFileId] = useState<string | undefined>();
  const [promotionalImageUrls, setPromotionalImageUrls] = useState<string[]>([]);

  // Section 6
  const [price, setPrice] = useState("12.99");
  const [discountPrice, setDiscountPrice] = useState("");
  const [promoPrice, setPromoPrice] = useState("");
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [taxSetting, setTaxSetting] = useState(TAX_SETTINGS[0]);
  const [fileFormat, setFileFormat] = useState(FILE_FORMATS[0]);

  // Section 7
  const [sellOnStore, setSellOnStore] = useState(true);
  const [includeInPromotions, setIncludeInPromotions] = useState(false);
  const [featuredRequest, setFeaturedRequest] = useState(false);
  const [allowDiscounts, setAllowDiscounts] = useState(true);
  const [allowBundles, setAllowBundles] = useState(false);
  const [affiliateEnabled, setAffiliateEnabled] = useState(false);
  const [activeMarketplace, setActiveMarketplace] = useState<typeof MARKETPLACES[number]["key"]>("amazon");
  const [marketplaceLinks, setMarketplaceLinks] = useState<Record<string, string>>({});

  // Section 8
  const [worldwideRights, setWorldwideRights] = useState(true);
  const [countryRestrictions, setCountryRestrictions] = useState("");
  const [copyrightHolder, setCopyrightHolder] = useState("");
  const [licenseType, setLicenseType] = useState(LICENSE_TYPES[0]);

  // Section 9
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [keywords, setKeywords] = useState("");

  // Print-only (Section: print config, shown when activeFormat === "print")
  const [trimCode, setTrimCode] = useState(LULU_CONFIG.trimSizes[2].code);
  const [interiorColor, setInteriorColor] = useState(LULU_CONFIG.interiorColors[0].code);
  const [printQuality, setPrintQuality] = useState(LULU_CONFIG.printQualities[0].code);
  const [binding, setBinding] = useState(LULU_CONFIG.bindings[0].code);
  const [paperType, setPaperType] = useState(LULU_CONFIG.paperTypes[0].code);
  const [coverFinish, setCoverFinish] = useState(LULU_CONFIG.coverFinishes[0].code);
  const [linenColor, setLinenColor] = useState(LULU_CONFIG.linenColors[0].code);
  const [foilColor, setFoilColor] = useState(LULU_CONFIG.foilColors[0].code);
  const [narrator, setNarrator] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const checklist = [
    { label: "Book title", ok: !!title.trim() },
    { label: "Author name", ok: !!authorFirstName.trim() && !!authorLastName.trim() },
    { label: "Category selected", ok: !!category },
    { label: "Age group selected", ok: !!ageGroup },
    { label: "Short description", ok: !!shortDescription.trim() },
    { label: "Cover image uploaded", ok: !!coverImageUrl },
    { label: "Manuscript uploaded", ok: !!manuscriptFileId },
    { label: "List price set", ok: Number(price) > 0 },
    { label: "Copyright holder named", ok: !!copyrightHolder.trim() },
  ];
  const allChecksPass = checklist.every((c) => c.ok);

  async function handleSubmit(submitForReview: boolean) {
    setSubmitting(true);
    setError(null);
    const res = await submitBook({
      title,
      subtitle,
      isbn,
      description: shortDescription,
      price: Number(price) || 0,
      ageGroup,
      category,
      genre,
      language,
      coverImageUrl,
      manuscriptFileId,
      samplePagesFileId,
      promotionalImageUrls,
      formats: { ebook: activeFormat === "ebook", print: activeFormat === "print", audiobook: activeFormat === "audiobook" },
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
        coAuthors,
        illustrator,
        editor,
        translator,
        authorBio,
        subgenre,
        readingLevel,
        schoolGrade,
        curriculum,
        longDescriptionHtml,
        backCoverDescription,
        learningObjectives,
        educationalBenefits,
        discountPrice: discountPrice ? Number(discountPrice) : undefined,
        promoPrice: promoPrice ? Number(promoPrice) : undefined,
        currency,
        taxSetting,
        worldwideRights,
        countryRestrictions,
        copyrightHolder,
        licenseType,
        sellOnStore,
        includeInPromotions,
        featuredRequest,
        allowDiscounts,
        allowBundles,
        affiliateEnabled,
        marketplaceLinks,
        seoTitle,
        seoDescription,
        keywords,
        fileType: activeFormat === "ebook" ? fileFormat : undefined,
        narrator: activeFormat === "audiobook" ? narrator : undefined,
        interiorColor: activeFormat === "print" ? interiorColor : undefined,
        printQuality: activeFormat === "print" ? printQuality : undefined,
        binding: activeFormat === "print" ? binding : undefined,
        paperType: activeFormat === "print" ? paperType : undefined,
        coverFinish: activeFormat === "print" ? coverFinish : undefined,
        linenColor: activeFormat === "print" && binding === "LW" ? linenColor : undefined,
        foilColor: activeFormat === "print" && binding === "LW" ? foilColor : undefined,
        trimSizeCode: activeFormat === "print" ? trimCode : undefined,
        podPackageId:
          activeFormat === "print"
            ? buildPodPackageId({ trimCode, colorCode: interiorColor, qualityCode: printQuality, bindingCode: binding, paperCode: paperType, finishCode: coverFinish, linenCode: linenColor, foilCode: foilColor })
            : undefined,
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
      <div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          {(["ebook", "print", "audiobook"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`btn btn-small ${activeFormat === f ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setActiveFormat(f)}
            >
              {f === "ebook" ? "eBook" : f === "print" ? "Print Copy" : "Audio book"}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12.5, color: "var(--ink-faint)" }}>
          Publishing a printed book? The Print Copy tab switches the format-specific section below to our
          print-on-demand configuration (trim size, binding, paper, finish). Audio book switches it to narrator
          details.
        </p>
      </div>

      {/* Section 1 */}
      <Card>
        <SectionHeader n={1} title="Book information" sub="Core bibliographic details." />
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
            <label className="field-label" htmlFor="f-isbn">ISBN</label>
            <input className="field" id="f-isbn" type="text" placeholder="978-1-59299-541-7" value={isbn} onChange={(e) => setIsbn(e.target.value)} />
            <div className="field-hint">Leave blank and we&apos;ll generate one for you.</div>
          </div>
          <div>
            <label className="field-label" htmlFor="f-copyrightyear">Copyright year</label>
            <input className="field" id="f-copyrightyear" type="number" value={copyrightYear} onChange={(e) => setCopyrightYear(e.target.value)} />
          </div>
        </div>
      </Card>

      {/* Section 2 */}
      <Card>
        <SectionHeader n={2} title="Author information" sub="Everyone credited on this title." />
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="f-authfirst">Primary author: first name</label>
            <input className="field" id="f-authfirst" type="text" value={authorFirstName} onChange={(e) => setAuthorFirstName(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="f-authlast">Primary author: last name</label>
            <input className="field" id="f-authlast" type="text" value={authorLastName} onChange={(e) => setAuthorLastName(e.target.value)} />
          </div>
        </div>
        <label className="field-label" htmlFor="f-coauthors">Co-author(s)</label>
        <input className="field" id="f-coauthors" type="text" placeholder="Comma-separated, if any" value={coAuthors} onChange={(e) => setCoAuthors(e.target.value)} />
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="f-illustrator">Illustrator</label>
            <input className="field" id="f-illustrator" type="text" value={illustrator} onChange={(e) => setIllustrator(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="f-editor">Editor</label>
            <input className="field" id="f-editor" type="text" value={editor} onChange={(e) => setEditor(e.target.value)} />
          </div>
        </div>
        <label className="field-label" htmlFor="f-translator">Translator</label>
        <input className="field" id="f-translator" type="text" placeholder="If this edition is translated" value={translator} onChange={(e) => setTranslator(e.target.value)} />
        <label className="field-label" htmlFor="f-authorbio">Author bio</label>
        <textarea className="field" id="f-authorbio" rows={3} placeholder="A couple of sentences about you, for your author page" value={authorBio} onChange={(e) => setAuthorBio(e.target.value)} />
      </Card>

      {/* Section 3 */}
      <Card>
        <SectionHeader n={3} title="Book classification" sub="How this title is categorized and shelved." />
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
        <label className="field-label" htmlFor="f-subgenre">Subgenre</label>
        <input className="field" id="f-subgenre" type="text" value={subgenre} onChange={(e) => setSubgenre(e.target.value)} />
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
        <label className="field-label" htmlFor="f-schoolgrade">School grade</label>
        <select className="field" id="f-schoolgrade" value={schoolGrade} onChange={(e) => setSchoolGrade(e.target.value)}>
          {SCHOOL_GRADES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="field-label" htmlFor="f-curriculum">Curriculum alignment</label>
        <input className="field" id="f-curriculum" type="text" placeholder="e.g. Common Core ELA, IB PYP" value={curriculum} onChange={(e) => setCurriculum(e.target.value)} />
      </Card>

      {/* Section 4 */}
      <Card>
        <SectionHeader n={4} title="Book description" sub="The copy readers, teachers, and our editorial team will see." />
        <label className="field-label" htmlFor="f-shortdesc">Short description</label>
        <textarea className="field" id="f-shortdesc" rows={2} placeholder="One or two sentences for listings and search results" value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} />
        <label className="field-label">Long description</label>
        <RichTextEditor value={longDescriptionHtml} onChange={setLongDescriptionHtml} placeholder="Write a few paragraphs about the story…" maxWords={400} />
        <label className="field-label" htmlFor="f-backcover">Back cover description</label>
        <textarea className="field" id="f-backcover" rows={3} placeholder="Shown on the printed back cover" value={backCoverDescription} onChange={(e) => setBackCoverDescription(e.target.value)} />
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="f-learnobj">Learning objectives</label>
            <textarea className="field" id="f-learnobj" rows={3} value={learningObjectives} onChange={(e) => setLearningObjectives(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="f-edubenefits">Educational benefits</label>
            <textarea className="field" id="f-edubenefits" rows={3} value={educationalBenefits} onChange={(e) => setEducationalBenefits(e.target.value)} />
          </div>
        </div>
      </Card>

      {/* Section 5 */}
      <Card>
        <SectionHeader n={5} title="Files" sub="Manuscript, cover, and supporting images. Type and size are validated automatically." />
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <FileUploadField
            label="Manuscript (PDF, EPUB, or MOBI)"
            sizeHint="Max 50MB"
            allowedTypes={["application/pdf", "application/epub+zip", "application/x-mobipocket-ebook"]}
            accept=".pdf,.epub,.mobi"
            onUploaded={(ids) => setManuscriptFileId(ids[0])}
          />
          <ImageUploadField label="Cover image" recommendedSize="Recommended 1600×2400px" value={coverImageUrl} onChange={setCoverImageUrl} />
          <FileUploadField
            label="Sample pages (PDF)"
            sizeHint="Optional preview excerpt"
            allowedTypes={["application/pdf"]}
            accept=".pdf"
            onUploaded={(ids) => setSamplePagesFileId(ids[0])}
          />
          <FileUploadField
            label="Promotional images"
            sizeHint="Multiple files allowed"
            allowedTypes={["image/jpeg", "image/png", "image/webp"]}
            accept="image/*"
            multiple
            onUploaded={(ids) => setPromotionalImageUrls(ids.map((id) => `/api/files/${id}`))}
          />
        </div>
      </Card>

      {/* Section 6 */}
      <Card>
        <SectionHeader n={6} title="Pricing" sub="What readers pay, and how discounts apply." />
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="f-price">List price</label>
            <input className="field" id="f-price" type="number" step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="f-discountprice">Discount price</label>
            <input className="field" id="f-discountprice" type="number" step={0.01} value={discountPrice} onChange={(e) => setDiscountPrice(e.target.value)} />
          </div>
        </div>
        <label className="field-label" htmlFor="f-promoprice">Promotional price</label>
        <input className="field" id="f-promoprice" type="number" step={0.01} value={promoPrice} onChange={(e) => setPromoPrice(e.target.value)} />
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="f-currency">Currency</label>
            <select className="field" id="f-currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="f-tax">Tax settings</label>
            <select className="field" id="f-tax" value={taxSetting} onChange={(e) => setTaxSetting(e.target.value)}>
              {TAX_SETTINGS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        {activeFormat === "ebook" && (
          <>
            <label className="field-label" htmlFor="f-fileformat">File format</label>
            <select className="field" id="f-fileformat" value={fileFormat} onChange={(e) => setFileFormat(e.target.value)}>
              {FILE_FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </>
        )}
        {activeFormat === "audiobook" && (
          <>
            <label className="field-label" htmlFor="f-narrator">Narrator</label>
            <input className="field" id="f-narrator" type="text" value={narrator} onChange={(e) => setNarrator(e.target.value)} />
          </>
        )}
        {activeFormat === "print" && (
          <div style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12.5, color: "var(--ink-faint)", marginBottom: 10 }}>
              Real Lulu print-on-demand configuration.
            </div>
            <div className="form-grid-2">
              <div>
                <label className="field-label" htmlFor="f-trim">Trim size</label>
                <select className="field" id="f-trim" value={trimCode} onChange={(e) => setTrimCode(e.target.value)}>
                  {LULU_CONFIG.trimSizes.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="f-color">Interior color</label>
                <select className="field" id="f-color" value={interiorColor} onChange={(e) => setInteriorColor(e.target.value)}>
                  {LULU_CONFIG.interiorColors.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid-2">
              <div>
                <label className="field-label" htmlFor="f-quality">Print quality</label>
                <select className="field" id="f-quality" value={printQuality} onChange={(e) => setPrintQuality(e.target.value)}>
                  {LULU_CONFIG.printQualities.map((q) => <option key={q.code} value={q.code}>{q.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="f-binding">Binding</label>
                <select className="field" id="f-binding" value={binding} onChange={(e) => setBinding(e.target.value)}>
                  {LULU_CONFIG.bindings.map((b) => <option key={b.code} value={b.code}>{b.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid-2">
              <div>
                <label className="field-label" htmlFor="f-paper">Paper type</label>
                <select className="field" id="f-paper" value={paperType} onChange={(e) => setPaperType(e.target.value)}>
                  {LULU_CONFIG.paperTypes.map((p) => <option key={p.code} value={p.code}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="f-finish">Cover finish</label>
                <select className="field" id="f-finish" value={coverFinish} onChange={(e) => setCoverFinish(e.target.value)}>
                  {LULU_CONFIG.coverFinishes.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}
                </select>
              </div>
            </div>
            {binding === "LW" && (
              <div className="form-grid-2">
                <div>
                  <label className="field-label" htmlFor="f-linen">Linen wrap color</label>
                  <select className="field" id="f-linen" value={linenColor} onChange={(e) => setLinenColor(e.target.value)}>
                    {LULU_CONFIG.linenColors.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="f-foil">Foil stamp color</label>
                  <select className="field" id="f-foil" value={foilColor} onChange={(e) => setFoilColor(e.target.value)}>
                    {LULU_CONFIG.foilColors.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}
                  </select>
                </div>
              </div>
            )}
            <div className="field-hint">
              Lulu package ID: <code>{buildPodPackageId({ trimCode, colorCode: interiorColor, qualityCode: printQuality, bindingCode: binding, paperCode: paperType, finishCode: coverFinish, linenCode: linenColor, foilCode: foilColor })}</code>
            </div>
          </div>
        )}
      </Card>

      {/* Section 7 */}
      <Card>
        <SectionHeader n={7} title="Distribution" sub="Where and how this title can be found and sold." />
        <div className="form-grid-2">
          <div>
            <div className="toggle-row">
              <label className="toggle-switch"><input type="checkbox" checked={sellOnStore} onChange={(e) => setSellOnStore(e.target.checked)} /><span className="toggle-slider" /></label>
              <span>Sell on store</span>
            </div>
            <div className="toggle-row">
              <label className="toggle-switch"><input type="checkbox" checked={featuredRequest} onChange={(e) => setFeaturedRequest(e.target.checked)} /><span className="toggle-slider" /></label>
              <span>Request featured placement</span>
            </div>
            <div className="toggle-row">
              <label className="toggle-switch"><input type="checkbox" checked={allowBundles} onChange={(e) => setAllowBundles(e.target.checked)} /><span className="toggle-slider" /></label>
              <span>Allow bundles</span>
            </div>
            <div className="toggle-row">
              <label className="toggle-switch"><input type="checkbox" checked={affiliateEnabled} onChange={(e) => setAffiliateEnabled(e.target.checked)} /><span className="toggle-slider" /></label>
              <span>Enable this book for the affiliate program</span>
            </div>
          </div>
          <div>
            <div className="toggle-row">
              <label className="toggle-switch"><input type="checkbox" checked={includeInPromotions} onChange={(e) => setIncludeInPromotions(e.target.checked)} /><span className="toggle-slider" /></label>
              <span>Include in promotions</span>
            </div>
            <div className="toggle-row">
              <label className="toggle-switch"><input type="checkbox" checked={allowDiscounts} onChange={(e) => setAllowDiscounts(e.target.checked)} /><span className="toggle-slider" /></label>
              <span>Allow discounts</span>
            </div>
          </div>
        </div>
        <label className="field-label" style={{ marginTop: 14 }}>Affiliate links by marketplace</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {MARKETPLACES.map((m) => (
            <button
              key={m.key}
              type="button"
              className={`btn btn-small ${activeMarketplace === m.key ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setActiveMarketplace(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <input
          className="field"
          type="url"
          placeholder={`Paste your ${MARKETPLACES.find((m) => m.key === activeMarketplace)?.label} link here`}
          value={marketplaceLinks[activeMarketplace] ?? ""}
          onChange={(e) => setMarketplaceLinks((m) => ({ ...m, [activeMarketplace]: e.target.value }))}
        />
      </Card>

      {/* Section 8 */}
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

      {/* Section 9 */}
      <Card>
        <SectionHeader n={9} title="SEO" sub="How this title appears in search results." />
        <label className="field-label" htmlFor="f-seotitle">SEO title</label>
        <input className="field" id="f-seotitle" type="text" placeholder="Defaults to the book title" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
        <label className="field-label" htmlFor="f-seodesc">SEO description</label>
        <textarea className="field" id="f-seodesc" rows={2} value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
        <label className="field-label" htmlFor="f-keywords">Keywords</label>
        <input className="field" id="f-keywords" type="text" placeholder="e.g. friendship, bedtime, forest animals" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
        <label className="field-label">Search preview</label>
        <div className="search-preview">
          <div className="sp-url">thegoodchildbookstore.com › book › {title ? title.toLowerCase().replace(/\s+/g, "-") : "..."}</div>
          <div className="sp-title">{seoTitle || title || "Your book title"}</div>
          <div className="sp-desc">{seoDescription || "Your SEO description will appear here."}</div>
        </div>
      </Card>

      {/* Section 10 */}
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
      </Card>

      {/* Section 11 */}
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
