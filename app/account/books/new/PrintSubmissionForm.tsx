"use client";

import { PublisherField } from "./PublisherField";
import { AgeGroupField } from "./AgeGroupField";
import { ageGroupProblem } from "@/lib/age-groups";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { submitBook, updateBookFull } from "@/actions/submissions";
import { ImageUploadField } from "@/components/ImageUploadField";
import { FileUploadField } from "@/components/FileUploadField";
import { ButtonGroup } from "@/components/ButtonGroup";
import { CoverWrapPreview } from "@/components/CoverWrapPreview";
import { Ean13Barcode } from "@/components/Ean13Barcode";
import { LULU_CONFIG, buildPodPackageId, labelForCode } from "@/lib/lulu-config";
import { computePrintPricing } from "@/lib/lulu-pricing";
import { computeCoverGeometry } from "@/lib/cover-preview";
import { detectTrimFromPageSize, formatInches, type DetectedTrim } from "@/lib/trim-size";
import { SectionHeader, Card, type SharedSubmissionFields } from "./shared";

import { CATEGORIES, GENRES, subcategoriesFor } from "@/lib/taxonomy";
const READING_LEVELS = ["Pre-reader", "Beginner", "Early Reader", "Independent Reader", "Fluent Reader"];
const LANGUAGES = ["English", "Spanish", "French", "Swahili"];

const PAPERBACK_BINDINGS = LULU_CONFIG.bindings.filter((b) => !b.hardcover);

/** Everything the print form can be pre-filled with when an existing print
 * edition is being edited (see app/account/books/[id]/edit/page.tsx). */
export interface PrintSubmissionInitial {
  bookId: string;
  bookStatus?: string;
  title: string;
  subtitle?: string;
  seriesName?: string;
  edition?: string;
  isbn?: string;
  language?: string;
  publisher?: string;
  publicationDate?: string;
  category?: string;
  genre?: string;
  subcategory?: string;
  ageGroup?: string;
  readingLevel?: string;
  description?: string;
  aiDeclaration?: string;
  authorFirstName?: string;
  authorLastName?: string;
  coAuthors?: string;
  illustrator?: string;
  editor?: string;
  translator?: string;
  printReadyPdfFileId?: string;
  pages?: number;
  dimensions?: string;
  frontCoverImageUrl?: string;
  customBackCoverPdfFileId?: string;
  backCoverMode?: "auto" | "custom";
  paperbackEnabled?: boolean;
  hardcoverEnabled?: boolean;
  trimCode?: string;
  paperbackBinding?: string;
  interiorColor?: string;
  printQuality?: string;
  paperType?: string;
  coverFinish?: string;
  linenColor?: string;
  foilColor?: string;
  foilStampTitleText?: string;
  foilStampAuthorText?: string;
  paperbackRetailPrice?: string;
  hardcoverRetailPrice?: string;
  luluGlobalDistribution?: boolean;
  privatePrinting?: boolean;
  affiliateEligiblePrint?: boolean;
  promotionalCampaignEligible?: boolean;
}


/**
 * Converted to match the exact reference design provided: "Submit a
 * print copy" — a dedicated print-on-demand workflow fulfilled through
 * Lulu, distinct from the eBook form. Paperback and Hardcover are
 * separate printable editions of the same title (each with its own
 * price, POD package ID, and cost/royalty breakdown), a real cover-wrap
 * preview with toggleable margin/bleed/fold/trim guides, and a real,
 * scannable EAN-13 barcode generated from the ISBN.
 *
 * Honesty note on the Pricing section: Lulu's real printing cost comes
 * from their live Print API cost-calculation endpoint, which needs real
 * API credentials and network access this environment doesn't have —
 * the numbers shown are a documented, labeled estimate (see
 * lib/lulu-pricing.ts), not a live quote.
 */
export function PrintSubmissionForm({
  prefill,
  initial,
  autofillRequest = 0,
}: {
  prefill?: SharedSubmissionFields;
  initial?: PrintSubmissionInitial;
  /** Goes up by one each time the author clicks the "Autofill from eBook" tab;
   * every increase copies the eBook tab's current details into this form. */
  autofillRequest?: number;
} = {}) {
  const router = useRouter();
  const editing = !!initial?.bookId;
  const editingPublished = editing && initial?.bookStatus === "PUBLISHED";

  // Section 1 — whatever the author already entered on the eBook /
  // Audiobook tab is pre-filled here (see SharedSubmissionFields in
  // ./shared.tsx) so there's nothing to re-type; every field stays
  // fully editable afterward.
  const [title, setTitle] = useState(initial?.title ?? prefill?.title ?? "");
  const [subtitle, setSubtitle] = useState(initial?.subtitle ?? prefill?.subtitle ?? "");
  const [seriesName, setSeriesName] = useState(initial?.seriesName ?? prefill?.seriesName ?? "");
  const [edition, setEdition] = useState(initial?.edition ?? prefill?.edition ?? "");
  const [isbn, setIsbn] = useState(initial ? (initial.isbn ?? "") : "978-1-59299-541-7");
  const [language, setLanguage] = useState(initial?.language || prefill?.language || LANGUAGES[0]);
  const [publisher, setPublisher] = useState(initial?.publisher ?? "");
  const [publicationDate, setPublicationDate] = useState(initial?.publicationDate ?? prefill?.publicationDate ?? "");
  const [category, setCategory] = useState(initial?.category ?? prefill?.category ?? "");
  const [genre, setGenre] = useState(initial?.genre ?? prefill?.genre ?? "");
  const [subcategory, setSubcategory] = useState(initial?.subcategory ?? prefill?.subcategory ?? "");
  const [ageGroup, setAgeGroup] = useState(initial?.ageGroup || prefill?.ageGroup || "0-2 years");
  const [readingLevel, setReadingLevel] = useState(initial?.readingLevel || prefill?.readingLevel || READING_LEVELS[0]);
  const [description, setDescription] = useState(initial?.description ?? prefill?.description ?? "");
  const descriptionWordCount = description.trim() ? description.trim().split(/\s+/).filter(Boolean).length : 0;
  // The author's own statement of how (or whether) they used AI in
  // creating this book — shown on the product page's detail card.
  const [aiDeclaration, setAiDeclaration] = useState(initial?.aiDeclaration ?? prefill?.aiDeclaration ?? "");

  // Section 2
  const [authorFirstName, setAuthorFirstName] = useState(initial?.authorFirstName ?? prefill?.authorFirstName ?? "");
  const [authorLastName, setAuthorLastName] = useState(initial?.authorLastName ?? prefill?.authorLastName ?? "");
  const [coAuthors, setCoAuthors] = useState(initial?.coAuthors ?? "");
  const [illustrator, setIllustrator] = useState(initial?.illustrator ?? "");
  const [editor, setEditor] = useState(initial?.editor ?? "");
  const [translator, setTranslator] = useState(initial?.translator ?? "");

  // Section 3
  const [printReadyPdfFileId, setPrintReadyPdfFileId] = useState<string | undefined>(initial?.printReadyPdfFileId);
  // Page count + trim-size dimensions, auto-detected from the uploaded
  // print-ready PDF itself (same readPdfMetadata() helper the eBook
  // manuscript upload already uses — see actions/files.ts) — reviewed/
  // editable, same "detect, pre-fill, let the author confirm or
  // correct" pattern as the eBook tab.
  const [printPages, setPrintPages] = useState(initial?.pages ? String(initial.pages) : "");
  const [printPagesAutoDetected, setPrintPagesAutoDetected] = useState(false);
  const [printDimensions, setPrintDimensions] = useState(initial?.dimensions ?? "");
  const [printDimensionsAutoDetected, setPrintDimensionsAutoDetected] = useState(false);
  const [frontCoverImageUrl, setFrontCoverImageUrl] = useState(initial?.frontCoverImageUrl ?? "");
  const [customBackCoverPdfFileId, setCustomBackCoverPdfFileId] = useState<string | undefined>(initial?.customBackCoverPdfFileId);
  // Which cover actually gets sent to Lulu: "auto" (front cover + our
  // generated spine/back) or "custom" (the author's own uploaded
  // complete wraparound). Set automatically by whichever of the two
  // cover uploads below the author most recently used.
  const [backCoverMode, setBackCoverMode] = useState<"auto" | "custom">(initial?.customBackCoverPdfFileId && initial.backCoverMode === "custom" ? "custom" : "auto");

  // Section 4
  const [paperbackEnabled, setPaperbackEnabled] = useState(initial?.paperbackEnabled ?? true);
  const [hardcoverEnabled, setHardcoverEnabled] = useState(initial?.hardcoverEnabled ?? true);

  // Section 5
  const [trimCode, setTrimCode] = useState(initial?.trimCode ?? LULU_CONFIG.trimSizes.find((t) => t.code === "0600X0900")?.code ?? LULU_CONFIG.trimSizes[0].code);
  // The trim size is read from the uploaded interior PDF's page size, so it
  // always matches the file Lulu will print from.
  const [detectedTrim, setDetectedTrim] = useState<DetectedTrim | null>(null);
  const [trimProblem, setTrimProblem] = useState<string | null>(null);
  const [paperbackBinding, setPaperbackBinding] = useState(initial?.paperbackBinding ?? PAPERBACK_BINDINGS[0].code);
  const [interiorColor, setInteriorColor] = useState(initial?.interiorColor ?? LULU_CONFIG.interiorColors[0].code);
  const [printQuality, setPrintQuality] = useState(initial?.printQuality ?? LULU_CONFIG.printQualities[0].code);
  const [paperType, setPaperType] = useState(initial?.paperType ?? LULU_CONFIG.paperTypes[0].code);
  const [coverFinish, setCoverFinish] = useState(initial?.coverFinish ?? LULU_CONFIG.coverFinishes[0].code);
  const [linenColor, setLinenColor] = useState(initial?.linenColor ?? LULU_CONFIG.linenColors[1].code);
  const [foilColor, setFoilColor] = useState(initial?.foilColor ?? LULU_CONFIG.foilColors[1].code);
  const [foilStampTitleText, setFoilStampTitleText] = useState(initial?.foilStampTitleText ?? "");
  const [foilStampAuthorText, setFoilStampAuthorText] = useState(initial?.foilStampAuthorText ?? "");

  // Section 6
  const [paperbackRetailPrice, setPaperbackRetailPrice] = useState(initial?.paperbackRetailPrice ?? "0");
  const [hardcoverRetailPrice, setHardcoverRetailPrice] = useState(initial?.hardcoverRetailPrice ?? "0");


  // Section 8
  // Every book is sold on the store, so "Sell through website" is no
  // longer a choice here (metadata always stores true for both flags).
  const [luluGlobalDistribution, setLuluGlobalDistribution] = useState(initial?.luluGlobalDistribution ?? true);
  const [privatePrinting, setPrivatePrinting] = useState(initial?.privatePrinting ?? false);
  const [affiliateEligiblePrint, setAffiliateEligiblePrint] = useState(initial?.affiliateEligiblePrint ?? false);
  const [promotionalCampaignEligible, setPromotionalCampaignEligible] = useState(initial?.promotionalCampaignEligible ?? false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [autofillNote, setAutofillNote] = useState<string | null>(null);

  // The "Autofill from eBook" tab: copy what was entered on the eBook /
  // Audiobook tab (title, description, cover, author, category, ...) into this
  // form. Fields the eBook tab left empty are skipped so nothing here is blanked.
  /* eslint-disable react-hooks/set-state-in-effect -- the copy is a one-off reaction to the author clicking the Autofill tab */
  useEffect(() => {
    if (!autofillRequest) return;
    if (!prefill || !prefill.title.trim()) {
      setAutofillNote("Nothing to copy yet - fill in the eBook / Audiobook tab first (title, description, cover...).");
      return;
    }
    const copied: string[] = [];
    const take = (value: string | undefined, set: (v: string) => void, label: string) => {
      if (value && value.trim()) { set(value); copied.push(label); }
    };
    take(prefill.title, setTitle, "title");
    take(prefill.subtitle, setSubtitle, "subtitle");
    take(prefill.seriesName, setSeriesName, "series");
    take(prefill.edition, setEdition, "edition");
    take(prefill.language, setLanguage, "language");
    take(prefill.publisher, setPublisher, "publisher");
    take(prefill.publicationDate, setPublicationDate, "publication date");
    take(prefill.category, setCategory, "category");
    take(prefill.genre, setGenre, "genre");
    take(prefill.subcategory, setSubcategory, "subcategory");
    take(prefill.ageGroup, setAgeGroup, "age range");
    take(prefill.readingLevel, setReadingLevel, "reading level");
    take(prefill.description, setDescription, "description");
    take(prefill.aiDeclaration, setAiDeclaration, "AI statement");
    take(prefill.authorFirstName, setAuthorFirstName, "author first name");
    take(prefill.authorLastName, setAuthorLastName, "author last name");
    take(prefill.coverImageUrl, setFrontCoverImageUrl, "front cover");
    setAutofillNote(`Filled in from your eBook details: ${copied.join(", ")}. Check each one, then add the print-only details below.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new click (autofillRequest) should copy; later edits to the eBook tab must not overwrite this form.
  }, [autofillRequest]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const foilCharsUsed = foilStampTitleText.length + foilStampAuthorText.length;

  const paperbackPodId = buildPodPackageId({
    trimCode, colorCode: interiorColor, qualityCode: printQuality, bindingCode: paperbackBinding, paperCode: paperType, finishCode: coverFinish, linenCode: "X", foilCode: "X",
  });
  const hardcoverPodId = buildPodPackageId({
    trimCode, colorCode: interiorColor, qualityCode: printQuality, bindingCode: "LW", paperCode: paperType, finishCode: coverFinish, linenCode: linenColor, foilCode: foilColor,
  });

  const paperbackPricing = computePrintPricing(Number(paperbackRetailPrice) || 0, paperbackBinding as "PB" | "CO");
  const hardcoverPricing = computePrintPricing(Number(hardcoverRetailPrice) || 0, "LW");

  async function handleSubmit(submitForReview: boolean) {
    const ageProblem = ageGroupProblem(ageGroup);
    if (ageProblem) {
      setError(ageProblem);
      return;
    }
    setSubmitting(true);
    setError(null);
    const payload = {
      title,
      subtitle,
      isbn,
      description,
      price: paperbackEnabled ? Number(paperbackRetailPrice) || 0 : Number(hardcoverRetailPrice) || 0,
      ageGroup,
      category,
      genre,
      subcategory,
      language,
      coverImageUrl: frontCoverImageUrl,
      manuscriptFileId: printReadyPdfFileId,
      formats: { ebook: false, print: true, audiobook: false },
      metadata: {
        authorFirstName,
        authorLastName,
        edition,
        seriesName,
        publisher: publisher.trim() || undefined,
        publicationDate,
        coAuthors,
        illustrator,
        editor,
        translator,
        readingLevel,
        aiDeclaration: aiDeclaration.trim() || undefined,
        pages: printPages ? Number(printPages) : undefined,
        dimensions: printDimensions.trim() || undefined,
        currency: "USD",
        taxSetting: "Calculate automatically by customer location",
        worldwideRights: true,
        licenseType: "All rights reserved",
        sellOnStore: true,
        includeInPromotions: promotionalCampaignEligible,
        featuredRequest: false,
        allowBundles: true,
        affiliateEnabled: affiliateEligiblePrint,
        paperbackEnabled,
        hardcoverEnabled,
        paperbackRetailPrice: Number(paperbackRetailPrice) || 0,
        hardcoverRetailPrice: Number(hardcoverRetailPrice) || 0,
        foilStampTitleText,
        foilStampAuthorText,
        printReadyPdfFileId,
        frontCoverImageUrl,
        customBackCoverPdfFileId,
        backCoverMode,
        sellThroughWebsite: true,
        luluGlobalDistribution,
        privatePrinting,
        affiliateEligiblePrint,
        promotionalCampaignEligible,
        interiorColor,
        printQuality,
        binding: paperbackEnabled ? paperbackBinding : "LW",
        paperType,
        coverFinish,
        linenColor,
        foilColor,
        trimSizeCode: trimCode,
        podPackageId: paperbackEnabled ? paperbackPodId : hardcoverPodId,
      },
      submitForReview,
    };
    if (initial?.bookId) {
      const res = await updateBookFull(initial.bookId, payload);
      setSubmitting(false);
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      if (res.outcome === "live") router.push("/account/books?saved=live");
      else if (res.outcome === "live_files_pending") router.push(`/account/books?saved=files-review-${res.held ?? "manuscript"}`);
      else router.push("/account/books");
      return;
    }
    const res = await submitBook(payload);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    router.push("/account/books");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {autofillNote && (
        <div className="field-hint" role="status" style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 14px", margin: 0 }}>
          {autofillNote}
        </div>
      )}
      {/* Section 1 */}
      <Card>
        <SectionHeader n={1} title="Book information" sub="Core bibliographic details for the print edition." />
        <label className="field-label" htmlFor="p-title">Book title</label>
        <input className="field" id="p-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="p-subtitle">Subtitle</label>
            <input className="field" id="p-subtitle" type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="p-series">Series</label>
            <input className="field" id="p-series" type="text" value={seriesName} onChange={(e) => setSeriesName(e.target.value)} />
          </div>
        </div>
        <div className="form-grid-3">
          <div>
            <label className="field-label" htmlFor="p-edition">Edition</label>
            <input className="field" id="p-edition" type="text" value={edition} onChange={(e) => setEdition(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="p-isbn">ISBN</label>
            <input className="field" id="p-isbn" type="text" value={isbn} onChange={(e) => setIsbn(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="p-lang">Language</label>
            <select className="field" id="p-lang" value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <PublisherField id="p-publisher" value={publisher} onChange={setPublisher} />
        <label className="field-label" htmlFor="p-pubdate">Publication date</label>
        <input className="field" id="p-pubdate" type="date" value={publicationDate} onChange={(e) => setPublicationDate(e.target.value)} />
        <div className="form-grid-3">
          <div>
            <label className="field-label" htmlFor="p-category">Category</label>
            <select className="field" id="p-category" value={category} onChange={(e) => { setCategory(e.target.value); setSubcategory(""); }}>
              <option value="">Select a category</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="p-genre">Genre</label>
            <select className="field" id="p-genre" value={genre} onChange={(e) => setGenre(e.target.value)}>
              <option value="">Select a genre</option>
              {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="p-subcategory">Subcategory</label>
            <select className="field" id="p-subcategory" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} disabled={!category}>
              <option value="">{category ? "Select a subcategory" : "Choose a category first"}</option>
              {subcategoriesFor(category).map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
        </div>
        <div className="form-grid-3">
          <AgeGroupField id="p-age" value={ageGroup} onChange={setAgeGroup} />
        </div>
        <label className="field-label" htmlFor="p-readinglevel">Reading level</label>
        <select className="field" id="p-readinglevel" value={readingLevel} onChange={(e) => setReadingLevel(e.target.value)}>
          {READING_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <label className="field-label" htmlFor="p-desc">Book description</label>
        <textarea className="field" id="p-desc" rows={4} placeholder="A short back-cover description of the book…" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div
          className="field-hint"
          style={descriptionWordCount > 200 ? { color: "var(--coral-deep)", fontWeight: 700 } : undefined}
        >
          {descriptionWordCount} / 200 words{descriptionWordCount > 200 ? " — over the limit, please shorten it" : ""}
        </div>
        <label className="field-label" htmlFor="p-ai-declaration" style={{ marginTop: 14 }}>AI use declaration</label>
        <p className="field-hint" style={{ margin: "0 0 8px" }}>
          Tell readers how, if at all, you used AI in creating this book — writing, editing, translation, or the cover
          and interior art. This shows on the book&apos;s product page exactly as written.
        </p>
        <textarea
          className="field"
          id="p-ai-declaration"
          rows={3}
          placeholder="e.g. &quot;Written and illustrated entirely by the author, with no AI involvement.&quot;"
          value={aiDeclaration}
          onChange={(e) => setAiDeclaration(e.target.value)}
        />
      </Card>

      {/* Section 2 */}
      <Card>
        <SectionHeader n={2} title="Author information" sub="Everyone credited on this edition." />
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="p-authfirst">Primary author: first name</label>
            <input className="field" id="p-authfirst" type="text" value={authorFirstName} onChange={(e) => setAuthorFirstName(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="p-authlast">Primary author: last name</label>
            <input className="field" id="p-authlast" type="text" value={authorLastName} onChange={(e) => setAuthorLastName(e.target.value)} />
          </div>
        </div>
        <label className="field-label" htmlFor="p-coauthors">Co-author(s)</label>
        <input className="field" id="p-coauthors" type="text" value={coAuthors} onChange={(e) => setCoAuthors(e.target.value)} />
        <div className="form-grid-3">
          <div>
            <label className="field-label" htmlFor="p-illustrator">Illustrator</label>
            <input className="field" id="p-illustrator" type="text" value={illustrator} onChange={(e) => setIllustrator(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="p-editor">Editor</label>
            <input className="field" id="p-editor" type="text" value={editor} onChange={(e) => setEditor(e.target.value)} />
          </div>
          <div>
            <label className="field-label" htmlFor="p-translator">Translator</label>
            <input className="field" id="p-translator" type="text" value={translator} onChange={(e) => setTranslator(e.target.value)} />
          </div>
        </div>
      </Card>

      {/* Section 3 */}
      <Card>
        <SectionHeader n={3} title="Files" sub="The central upload area for all print assets. Print-ready files are validated automatically on upload." />
        <div className="upload-cards-row">
          <FileUploadField
            label="Print-Ready PDF"
            sizeHint="The complete interior pages of the book"
            allowedTypes={["application/pdf"]}
            accept=".pdf"
            initialFileName={initial?.printReadyPdfFileId ? "Print-ready PDF already uploaded" : undefined}
            onUploaded={(ids) => setPrintReadyPdfFileId(ids[0])}
            onFileMeta={(results) => {
              const result = results[0];
              if (typeof result?.pageCount === "number") {
                setPrintPages(String(result.pageCount));
                setPrintPagesAutoDetected(true);
              } else {
                setPrintPagesAutoDetected(false);
              }
              if (result?.dimensions) {
                setPrintDimensions(result.dimensions);
                setPrintDimensionsAutoDetected(true);
              } else {
                setPrintDimensionsAutoDetected(false);
              }
              if (typeof result?.pageWidthIn === "number" && typeof result?.pageHeightIn === "number") {
                const found = detectTrimFromPageSize(result.pageWidthIn, result.pageHeightIn, LULU_CONFIG.trimSizes);
                setDetectedTrim(found);
                if (found) {
                  setTrimCode(found.code);
                  setTrimProblem(null);
                } else {
                  setTrimProblem(`Your PDF's pages are ${formatInches(result.pageWidthIn, result.pageHeightIn)}, which doesn't match any trim size we can print. Re-export the interior at the exact trim size (or trim size plus 0.125 in bleed) and upload it again.`);
                }
              } else {
                setDetectedTrim(null);
                setTrimProblem(null);
              }
            }}
            fillWidth
          />
          <ImageUploadField
            label="Front Cover Only"
            recommendedSize="PNG or JPEG — automatically converted to WebP"
            value={frontCoverImageUrl}
            onChange={(url) => { setFrontCoverImageUrl(url); setBackCoverMode("auto"); }}
            accept="image/png,image/jpeg"
            fillWidth
          />
          <FileUploadField
            label="Custom Cover (optional)"
            sizeHint="PDF — your own complete wraparound cover (front, spine, back)"
            allowedTypes={["application/pdf"]}
            accept=".pdf"
            initialFileName={initial?.customBackCoverPdfFileId ? "Custom cover already uploaded" : undefined}
            onUploaded={(ids) => { setCustomBackCoverPdfFileId(ids[0]); setBackCoverMode("custom"); }}
            onRemove={() => { setCustomBackCoverPdfFileId(undefined); setBackCoverMode("auto"); }}
            fillWidth
          />
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 8 }}>
          {backCoverMode === "custom"
            ? "Your uploaded wraparound cover (front, spine, and back) is the one that will be sent to Lulu — the auto-generated version won't be used."
            : "Upload only your professionally designed front cover. The matching spine and back cover are generated automatically from the dominant colour palette, book description, and ISBN already entered — this auto-generated wraparound is what gets sent to Lulu."}
        </p>
        {backCoverMode === "custom" && (() => {
          const geo = computeCoverGeometry(trimCode, paperType, 32);
          const wIn = (geo.trimWidthIn * 2 + geo.spineWidthIn + geo.bleedIn * 2).toFixed(3);
          const hIn = (geo.trimHeightIn + geo.bleedIn * 2).toFixed(3);
          const trimLabel = LULU_CONFIG.trimSizes.find((t) => t.code === trimCode)?.label ?? trimCode;
          return (
            <>
              <p className="field-hint" style={{ marginTop: 8 }}>Custom back cover specifications, matching your current print settings:</p>
              <table className="spec-requirement-table">
                <tbody>
                  <tr><td>Required width (with bleed)</td><td>{wIn} in</td></tr>
                  <tr><td>Required height (with bleed)</td><td>{hIn} in</td></tr>
                  <tr><td>Spine width</td><td>{geo.spineWidthIn.toFixed(3)} in</td></tr>
                  <tr><td>Resolution</td><td>300 DPI minimum</td></tr>
                  <tr><td>Bleed</td><td>0.125 in on all outer edges</td></tr>
                  <tr><td>Safe area</td><td>0.5 in inside trim line</td></tr>
                  <tr><td>Trim size</td><td>{trimLabel}</td></tr>
                  <tr><td>Color profile</td><td>CMYK recommended</td></tr>
                  <tr><td>File size limit</td><td>Up to 4 MB</td></tr>
                  <tr><td>Accepted format</td><td>PDF only</td></tr>
                </tbody>
              </table>
            </>
          );
        })()}
        <p style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 8 }}>
          File type and size are checked immediately. Resolution, bleed, trim-size match, and embedded fonts are
          checked by our print partner once the job is submitted; any issues are reported back before printing
          begins.
        </p>
      </Card>

      {/* Section 4 */}
      <Card>
        <SectionHeader n={4} title="Publication format" sub="Choose Paperback, Hardcover, or both as separate printable editions of this title." />
        <div style={{ display: "flex", gap: 32 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600 }}>
            <input type="checkbox" checked={paperbackEnabled} onChange={(e) => setPaperbackEnabled(e.target.checked)} /> Paperback
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, marginLeft: "3.5in" }}>
            <input type="checkbox" checked={hardcoverEnabled} onChange={(e) => setHardcoverEnabled(e.target.checked)} /> Hardcover (Linen Wrap)
          </label>
        </div>
      </Card>

      {/* Section 5 */}
      <Card>
        <SectionHeader n={5} title="Book specifications" sub="Every option here maps directly to a Lulu Print API POD Package code." />
        <label className="field-label">Trim size</label>
        <ButtonGroup options={LULU_CONFIG.trimSizes} value={trimCode} onChange={setTrimCode} />
        {detectedTrim && detectedTrim.code === trimCode && (
          <div className="field-hint">
            Picked automatically from your uploaded PDF ({detectedTrim.label}{detectedTrim.withBleed ? ", with bleed" : ""}).
          </div>
        )}
        {detectedTrim && detectedTrim.code !== trimCode && (
          <div className="field-hint" role="alert" style={{ color: "var(--coral-deep)" }}>
            Your uploaded PDF is {detectedTrim.label}, but a different trim size is selected. Lulu will reject the book unless they match.{" "}
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setTrimCode(detectedTrim.code)}>Use {detectedTrim.label}</button>
          </div>
        )}
        {trimProblem && <div className="field-hint" role="alert" style={{ color: "var(--coral-deep)" }}>{trimProblem}</div>}
        {!detectedTrim && !trimProblem && (
          <div className="field-hint">The trim size is picked automatically once you upload the print-ready PDF above.</div>
        )}
        {paperbackEnabled && (
          <>
            <label className="field-label">Paperback binding</label>
            <ButtonGroup options={PAPERBACK_BINDINGS} value={paperbackBinding} onChange={setPaperbackBinding} />
          </>
        )}
        <label className="field-label">Interior color</label>
        <ButtonGroup options={LULU_CONFIG.interiorColors} value={interiorColor} onChange={setInteriorColor} />
        <label className="field-label">Print quality</label>
        <ButtonGroup options={LULU_CONFIG.printQualities} value={printQuality} onChange={setPrintQuality} />
        <label className="field-label">Paper type</label>
        <ButtonGroup options={LULU_CONFIG.paperTypes} value={paperType} onChange={setPaperType} />
        {paperbackEnabled && (
          <>
            <label className="field-label">Cover finish (paperback/coil)</label>
            <ButtonGroup options={LULU_CONFIG.coverFinishes} value={coverFinish} onChange={setCoverFinish} />
          </>
        )}
        {hardcoverEnabled && (
          <>
            <label className="field-label">Linen wrap color (hardcover)</label>
            <ButtonGroup options={LULU_CONFIG.linenColors.filter((l) => l.code !== "X")} value={linenColor} onChange={setLinenColor} />
            <label className="field-label">Foil stamp color (hardcover spine)</label>
            <ButtonGroup options={LULU_CONFIG.foilColors.filter((f) => f.code !== "X")} value={foilColor} onChange={setFoilColor} />
            <div className="form-grid-2">
              <div>
                <label className="field-label" htmlFor="p-foiltitle">Foil stamp: title text</label>
                <input className="field" id="p-foiltitle" type="text" value={foilStampTitleText} onChange={(e) => setFoilStampTitleText(e.target.value.slice(0, 42 - foilStampAuthorText.length))} />
              </div>
              <div>
                <label className="field-label" htmlFor="p-foilauthor">Foil stamp: author text</label>
                <input className="field" id="p-foilauthor" type="text" value={foilStampAuthorText} onChange={(e) => setFoilStampAuthorText(e.target.value.slice(0, 42 - foilStampTitleText.length))} />
              </div>
            </div>
            <p style={{ fontSize: 12, color: "var(--ink-faint)" }}>
              Title and author foil text combined cannot exceed 42 characters ({foilCharsUsed}/42 used). Roman characters only.
            </p>
          </>
        )}
        <div className="form-grid-2" style={{ marginTop: 4 }}>
          <div>
            <label className="field-label" htmlFor="p-pages">Pages</label>
            <input
              className="field"
              id="p-pages"
              type="number"
              min={1}
              placeholder="Upload a print-ready PDF to auto-fill"
              value={printPages}
              onChange={(e) => { setPrintPages(e.target.value); setPrintPagesAutoDetected(false); }}
            />
            <div className="field-hint">
              {printPagesAutoDetected ? "Auto-detected from your uploaded print-ready PDF — edit if it's not quite right." : "Auto-fills once you upload the print-ready PDF above."}
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="p-dimensions">Trim dimensions (as uploaded)</label>
            <input
              className="field"
              id="p-dimensions"
              type="text"
              placeholder="Upload a print-ready PDF to auto-fill"
              value={printDimensions}
              onChange={(e) => { setPrintDimensions(e.target.value); setPrintDimensionsAutoDetected(false); }}
            />
            <div className="field-hint">
              {printDimensionsAutoDetected ? "Auto-detected from your uploaded print-ready PDF — edit if it's not quite right." : "Auto-fills once you upload the print-ready PDF above. The Trim size buttons above are what's actually sent to Lulu."}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 16 }}>
          {paperbackEnabled && (
            <div>
              <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 6 }}>
                Paperback POD Package ID: <code>{paperbackPodId}</code>
              </p>
              <table className="spec-requirement-table">
                <tbody>
                  <tr><td>Trim size</td><td>{LULU_CONFIG.trimSizes.find((t) => t.code === trimCode)?.label ?? trimCode}</td></tr>
                  <tr><td>Binding</td><td>{labelForCode(PAPERBACK_BINDINGS, paperbackBinding)}</td></tr>
                  <tr><td>Interior color</td><td>{labelForCode(LULU_CONFIG.interiorColors, interiorColor)}</td></tr>
                  <tr><td>Print quality</td><td>{labelForCode(LULU_CONFIG.printQualities, printQuality)}</td></tr>
                  <tr><td>Paper type</td><td>{labelForCode(LULU_CONFIG.paperTypes, paperType)}</td></tr>
                  <tr><td>Cover finish</td><td>{labelForCode(LULU_CONFIG.coverFinishes, coverFinish)}</td></tr>
                </tbody>
              </table>
            </div>
          )}
          {hardcoverEnabled && (
            <div>
              <p style={{ fontSize: 12.5, color: "var(--ink-soft)", marginBottom: 6 }}>
                Hardcover POD Package ID: <code>{hardcoverPodId}</code>
              </p>
              <table className="spec-requirement-table">
                <tbody>
                  <tr><td>Trim size</td><td>{LULU_CONFIG.trimSizes.find((t) => t.code === trimCode)?.label ?? trimCode}</td></tr>
                  <tr><td>Binding</td><td>Linen Wrap (Hardcover)</td></tr>
                  <tr><td>Interior color</td><td>{labelForCode(LULU_CONFIG.interiorColors, interiorColor)}</td></tr>
                  <tr><td>Print quality</td><td>{labelForCode(LULU_CONFIG.printQualities, printQuality)}</td></tr>
                  <tr><td>Paper type</td><td>{labelForCode(LULU_CONFIG.paperTypes, paperType)}</td></tr>
                  <tr><td>Cover finish</td><td>{labelForCode(LULU_CONFIG.coverFinishes, coverFinish)}</td></tr>
                  <tr><td>Linen wrap color</td><td>{labelForCode(LULU_CONFIG.linenColors, linenColor)}</td></tr>
                  <tr><td>Foil stamp color</td><td>{labelForCode(LULU_CONFIG.foilColors, foilColor)}</td></tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Section 6 */}
      <Card>
        <SectionHeader n={6} title="Pricing" sub="Each format is priced and printed as a separate edition." />
        <div className="form-grid-2">
          {paperbackEnabled && (
            <div>
              <label className="field-label" htmlFor="p-pbprice">Paperback retail price</label>
              <input className="field" id="p-pbprice" type="number" step={0.01} value={paperbackRetailPrice} onChange={(e) => setPaperbackRetailPrice(e.target.value)} />
            </div>
          )}
          {hardcoverEnabled && (
            <div>
              <label className="field-label" htmlFor="p-hcprice">Hardcover retail price</label>
              <input className="field" id="p-hcprice" type="number" step={0.01} value={hardcoverRetailPrice} onChange={(e) => setHardcoverRetailPrice(e.target.value)} />
            </div>
          )}
        </div>
        {paperbackEnabled && (
          <div className="stat-grid" style={{ marginTop: 12, marginBottom: 0 }}>
            <div><div className="stat-label">Paperback printing cost</div><div className="stat-value" style={{ fontSize: 20 }}>${paperbackPricing.printingCost.toFixed(2)}</div><div className="stat-sub">Via Lulu print partner</div></div>
            <div><div className="stat-label">Company revenue</div><div className="stat-value" style={{ fontSize: 20 }}>${paperbackPricing.companyRevenue.toFixed(2)}</div><div className="stat-sub">30% of retail price</div></div>
            <div><div className="stat-label">Author profit</div><div className="stat-value" style={{ fontSize: 20 }}>${paperbackPricing.authorProfit.toFixed(2)}</div><div className="stat-sub">After printing cost</div></div>
            <div><div className="stat-label">Estimated royalty</div><div className="stat-value" style={{ fontSize: 20 }}>${paperbackPricing.estimatedRoyalty.toFixed(2)}</div><div className="stat-sub">Per copy sold</div></div>
          </div>
        )}
        {hardcoverEnabled && (
          <div className="stat-grid" style={{ marginTop: paperbackEnabled ? 20 : 12, marginBottom: 0 }}>
            <div><div className="stat-label">Hardcover printing cost</div><div className="stat-value" style={{ fontSize: 20 }}>${hardcoverPricing.printingCost.toFixed(2)}</div><div className="stat-sub">Via Lulu print partner</div></div>
            <div><div className="stat-label">Company revenue</div><div className="stat-value" style={{ fontSize: 20 }}>${hardcoverPricing.companyRevenue.toFixed(2)}</div><div className="stat-sub">30% of retail price</div></div>
            <div><div className="stat-label">Author profit</div><div className="stat-value" style={{ fontSize: 20 }}>${hardcoverPricing.authorProfit.toFixed(2)}</div><div className="stat-sub">After printing cost</div></div>
            <div><div className="stat-label">Estimated royalty</div><div className="stat-value" style={{ fontSize: 20 }}>${hardcoverPricing.estimatedRoyalty.toFixed(2)}</div><div className="stat-sub">Per copy sold</div></div>
          </div>
        )}
      </Card>

      {/* Section 8 */}
      <Card>
        <SectionHeader n={7} title="Distribution" sub="Where this print edition can be sold." />
        <div className="form-grid-2">
          <div>
            <div className="toggle-row">
              <label className="toggle-switch"><input type="checkbox" checked={privatePrinting} onChange={(e) => setPrivatePrinting(e.target.checked)} /><span className="toggle-slider" /></label>
              <span>Private printing (author copies only)</span>
            </div>
            <div className="toggle-row">
              <label className="toggle-switch"><input type="checkbox" checked={promotionalCampaignEligible} onChange={(e) => setPromotionalCampaignEligible(e.target.checked)} /><span className="toggle-slider" /></label>
              <span>Promotional campaign eligible</span>
            </div>
          </div>
          <div>
            <div className="toggle-row">
              <label className="toggle-switch"><input type="checkbox" checked={luluGlobalDistribution} onChange={(e) => setLuluGlobalDistribution(e.target.checked)} /><span className="toggle-slider" /></label>
              <span>Lulu global distribution</span>
            </div>
            <div className="toggle-row">
              <label className="toggle-switch"><input type="checkbox" checked={affiliateEligiblePrint} onChange={(e) => setAffiliateEligiblePrint(e.target.checked)} /><span className="toggle-slider" /></label>
              <span>Affiliate eligible</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Section 9 */}
      <Card>
        <SectionHeader n={8} title="Book Preview" sub="Use this preview window to see how your book will look. Carefully review the margin, bleed, and fold areas to ensure your book will print correctly." />
        {customBackCoverPdfFileId && (
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            <button type="button" className={`btn btn-small ${backCoverMode === "auto" ? "btn-primary" : "btn-ghost"}`} onClick={() => setBackCoverMode("auto")}>
              Auto-generated cover
            </button>
            <button type="button" className={`btn btn-small ${backCoverMode === "custom" ? "btn-primary" : "btn-ghost"}`} onClick={() => setBackCoverMode("custom")}>
              My custom cover
            </button>
          </div>
        )}
        <CoverWrapPreview
          customCoverFileId={backCoverMode === "custom" ? customBackCoverPdfFileId : undefined}
          pages={Number(printPages) || 32}
          title={title}
          subtitle={subtitle}
          authorFirstName={authorFirstName}
          authorLastName={authorLastName}
          description={description}
          isbn={isbn}
          trimCode={trimCode}
          paperCode={paperType}
          coverImageUrl={frontCoverImageUrl}
        />
      </Card>

      {/* Section 10 */}
      <Card>
        <SectionHeader n={9} title="ISBN Barcode" sub="Generated automatically from the ISBN assigned to this title." />
        <Ean13Barcode isbn={isbn} />
      </Card>

      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      <div>
        <button type="button" className="btn btn-primary btn-small" disabled={submitting || !!ageGroupProblem(ageGroup)} onClick={() => handleSubmit(true)}>
          {submitting
            ? (editing ? "Saving…" : "Submitting…")
            : editing
            ? (editingPublished ? "Save changes" : "Save and resubmit for review")
            : "Submit print copy"}
        </button>
      </div>
    </div>
  );
}
