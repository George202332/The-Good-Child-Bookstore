"use client";

import { PublisherField } from "./PublisherField";
import { AgeGroupField } from "./AgeGroupField";
import { ageGroupProblem } from "@/lib/age-groups";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { submitBook, updateBookFull } from "@/actions/submissions";
import { describeUploadedFile, type UploadFileResult } from "@/actions/files";
import { startPrintPreflight, pollPrintPreflight, type PrintPreflightView } from "@/actions/print-preflight";
import { packagesFor } from "@/lib/print-preflight-packages";
import { coverKeyFor, packageKey, type SavedPreflight } from "@/lib/print-preflight-result";
import { ImageUploadField } from "@/components/ImageUploadField";
import { FileUploadField } from "@/components/FileUploadField";
import { ChoiceChips } from "@/components/ChoiceChips";
import { AffiliateCopyOffer } from "@/components/AffiliateCopyOffer";
import { ButtonGroup } from "@/components/ButtonGroup";
import { CoverWrapPreview } from "@/components/CoverWrapPreview";
import { ManuscriptReviewViewer } from "@/components/ManuscriptReviewViewer";
import { Ean13Barcode } from "@/components/Ean13Barcode";
import { LULU_CONFIG, buildPodPackageId, labelForCode } from "@/lib/lulu-config";
import { computePrintPricing, computePrintPricingFromCost } from "@/lib/lulu-pricing";
import { analyzePrintInterior, fixPrintFonts, quotePrintCost, type FixFontsResult, type PrintCostItem, type PrintSpecReport } from "@/actions/print-specs";
import { checkPriceFloor } from "@/lib/print-specs";
import { capitalizeName } from "@/lib/person-name";
import { isbn13Of, isbnProblem } from "@/lib/identifiers";
import { PrintSpecsPanel } from "./PrintSpecsPanel";
import { AiDeclarationField } from "@/components/AiDeclarationField";
import { aiChoiceOf, isLegacyAiText } from "@/lib/ai-declaration";
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
  /** The print ISBN of each format, when it has one (never shared between formats). */
  printIsbn?: string;
  /** The saved result of the last print file check. */
  preflight?: SavedPreflight;
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
  printReadyPdfFileId?: string;
  /** The file the author first uploaded, when fonts were embedded in a copy for them. */
  printReadyOriginalPdfFileId?: string;
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
  extraActions,
  aiShared,
}: {
  /** The book-wide AI declaration, held by the tabs so the eBook and Print forms always show the same answer. */
  aiShared?: { value: string; onChange: (v: string) => void };
  /** The eBook's details (the title is being added as a print edition of it). When given,
   * an "Autofill from eBook" button inside this tab copies them - text, cover and the
   * uploaded file - into this form. */
  prefill?: SharedSubmissionFields;
  initial?: PrintSubmissionInitial;
  /** Edit view only: extra buttons shown in the same row, to the right of Save / Submit. */
  extraActions?: React.ReactNode;
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
  // The author's own ISBN for the print edition (optional). Nothing is requested from Lulu: its Print API has no ISBN call.
  const [printIsbn, setPrintIsbn] = useState(initial?.printIsbn ?? "");
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
  const [aiLocal, setAiLocal] = useState(initial?.aiDeclaration ?? prefill?.aiDeclaration ?? "");
  const aiDeclaration = aiShared ? aiShared.value : aiLocal;
  const setAiDeclaration = aiShared ? aiShared.onChange : setAiLocal;

  // Section 2
  const [authorFirstName, setAuthorFirstName] = useState(initial?.authorFirstName ?? prefill?.authorFirstName ?? "");
  const [authorLastName, setAuthorLastName] = useState(initial?.authorLastName ?? prefill?.authorLastName ?? "");

  // Section 3
  const [printReadyPdfFileId, setPrintReadyPdfFileId] = useState<string | undefined>(initial?.printReadyPdfFileId);
  // When fonts are embedded for the author, the fixed copy becomes the interior and the file they uploaded is kept here.
  const [originalPdfFileId, setOriginalPdfFileId] = useState<string | undefined>(initial?.printReadyOriginalPdfFileId);
  // Page count + trim-size dimensions, auto-detected from the uploaded
  // print-ready PDF itself (same readPdfMetadata() helper the eBook
  // manuscript upload already uses — see actions/files.ts) — reviewed/
  // editable, same "detect, pre-fill, let the author confirm or
  // correct" pattern as the eBook tab.
  const [printPages, setPrintPages] = useState(initial?.pages ? String(initial.pages) : "");
  const [printPagesAutoDetected, setPrintPagesAutoDetected] = useState(false);
  // Mirrors printPagesAutoDetected for the async file reader below (set only from event handlers).
  const pagesAutoRef = useRef(false);
  const markPagesAuto = (v: boolean) => { setPrintPagesAutoDetected(v); pagesAutoRef.current = v; };
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

  // Reads a freshly uploaded (or carried-over) interior PDF: page count, page size and the
  // trim size that matches it. The same steps for both ways a file can arrive.
  function applyInteriorMeta(result: UploadFileResult | undefined) {
    if (typeof result?.pageCount === "number") {
      setPrintPages(String(result.pageCount));
      markPagesAuto(true);
    } else {
      markPagesAuto(false);
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
  }

  // The "Autofill from eBook" button (inside this tab): copies what was entered on the eBook /
  // Audiobook tab - the text details, the cover image AND the uploaded file - into this form.
  // Fields the eBook tab left empty are skipped so nothing here is blanked. The author can edit
  // everything afterwards, and every file that comes across goes through the same print file
  // check as one uploaded directly.
  const [autofilling, setAutofilling] = useState(false);
  async function autofillFromEbook() {
    if (!prefill || !prefill.title.trim()) {
      setAutofillNote("Nothing to copy yet - fill in the eBook and Audiobook tab first (title, description, cover...).");
      return;
    }
    setAutofilling(true);
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
    if (prefill.coverImageUrl) {
      setFrontCoverImageUrl(prefill.coverImageUrl);
      setBackCoverMode("auto");
      copied.push("front cover image");
    }
    let fileNote = "";
    if (prefill.manuscriptFileId) {
      // Only a PDF can be printed. The same file may serve both the eBook and the print edition.
      const info = await describeUploadedFile(prefill.manuscriptFileId).catch(() => null);
      if (info?.ok && info.mimeType === "application/pdf") {
        setPrintReadyPdfFileId(info.fileId);
        setCarriedFileName(info.fileName ?? prefill.manuscriptFileName ?? "Manuscript PDF");
        applyInteriorMeta(info);
        copied.push("print-ready PDF");
      } else if (info?.ok) {
        fileNote = " Your eBook file is not a PDF, so it cannot be printed - upload a print-ready PDF in the Files section below.";
      }
    }
    setAutofillNote(`Filled in from your eBook details: ${copied.join(", ")}. Check each one, then add the print-only details below.${fileNote}`);
    setAutofilling(false);
  }

  // The interior PDF that arrived by autofill (rather than an upload on this card), shown by name.
  const [carriedFileName, setCarriedFileName] = useState<string | undefined>(undefined);

  // ---- Print file check (Lulu pre-flight) --------------------------------------------------
  // Runs by itself as soon as the interior and a cover are in, and again whenever a file or a
  // print setting that matters changes. Plain-language results appear right here; a print edition
  // that does not pass cannot be submitted.
  const [preflight, setPreflight] = useState<PrintPreflightView | null>(null);
  const [preflightBusy, setPreflightBusy] = useState(false);
  const coverKey = coverKeyFor({ customCoverFileId: backCoverMode === "custom" ? customBackCoverPdfFileId : undefined, frontCoverImageUrl });
  const packages = useMemo(
    () => packagesFor({ trimCode, paperbackEnabled, hardcoverEnabled, paperbackBinding, interiorColor, printQuality, paperType, coverFinish, linenColor, foilColor }),
    [trimCode, paperbackEnabled, hardcoverEnabled, paperbackBinding, interiorColor, printQuality, paperType, coverFinish, linenColor, foilColor],
  );
  const currentKeys = `${printReadyPdfFileId ?? ""}|${coverKey}|${packageKey(packages.map((p) => p.packageId))}`;
  const checkedKeys = useRef<string>("");
  const runPreflight = useCallback(async () => {
    if (!printReadyPdfFileId || packages.length === 0 || (!frontCoverImageUrl && !(backCoverMode === "custom" && customBackCoverPdfFileId))) return;
    setPreflightBusy(true);
    checkedKeys.current = currentKeys;
    const res = await startPrintPreflight({
      interiorFileId: printReadyPdfFileId,
      frontCoverImageUrl: frontCoverImageUrl || undefined,
      customCoverFileId: backCoverMode === "custom" ? customBackCoverPdfFileId : undefined,
      trimCode, paperbackEnabled, hardcoverEnabled, paperbackBinding, interiorColor, printQuality, paperType, coverFinish, linenColor, foilColor,
      title, authorName: `${authorFirstName} ${authorLastName}`.trim(),
    }).catch(() => ({ ok: false, error: "The check could not be started. Please try again." }) as PrintPreflightView);
    setPreflight(res);
    setPreflightBusy(false);
  }, [printReadyPdfFileId, packages, frontCoverImageUrl, backCoverMode, customBackCoverPdfFileId, currentKeys, trimCode, paperbackEnabled, hardcoverEnabled, paperbackBinding, interiorColor, printQuality, paperType, coverFinish, linenColor, foilColor, title, authorFirstName, authorLastName]);

  useEffect(() => {
    if (!printReadyPdfFileId || checkedKeys.current === currentKeys) return;
    // An edit that has not touched the files keeps the result already saved on the book.
    if (editing && initial?.preflight && `${initial.printReadyPdfFileId ?? ""}|${initial.preflight.coverKey}|${initial.preflight.packageIds}` === currentKeys) {
      checkedKeys.current = currentKeys;
      return;
    }
    const t = setTimeout(() => { void runPreflight(); }, 700);
    return () => clearTimeout(t);
  }, [currentKeys, printReadyPdfFileId, runPreflight, editing, initial]);

  // While Lulu is working, ask for progress every few seconds (each ask is quick).
  useEffect(() => {
    if (preflight?.status !== "CHECKING" || !preflight.checkId) return;
    const id = preflight.checkId;
    const t = setTimeout(async () => {
      const next = await pollPrintPreflight(id).catch(() => null);
      if (next) setPreflight(next);
    }, 3000);
    return () => clearTimeout(t);
  }, [preflight]);

  // The saved result of an unchanged edit counts as passed; otherwise the live check decides.
  const unchangedSaved = editing && !!initial?.preflight && `${initial.printReadyPdfFileId ?? ""}|${initial.preflight.coverKey}|${initial.preflight.packageIds}` === currentKeys && initial.preflight.status === "PASSED";
  const preflightPassed = preflight?.status === "PASSED" || (!preflight && unchangedSaved);
  const hasPrintFiles = !!printReadyPdfFileId && (!!frontCoverImageUrl || (backCoverMode === "custom" && !!customBackCoverPdfFileId));


  // ---- What we read from the file, fonts, and Lulu's real printing cost ----------------------
  const [specReport, setSpecReport] = useState<PrintSpecReport | null>(null);
  const [specBusy, setSpecBusy] = useState(false);
  const [fontBusy, setFontBusy] = useState(false);
  const [fontResult, setFontResult] = useState<FixFontsResult | null>(null);
  const autoFontTried = useRef("");
  const specSettings = useMemo(
    () => ({ paperbackEnabled, hardcoverEnabled, paperbackBinding, interiorColor, printQuality, paperType, coverFinish, linenColor, foilColor }),
    [paperbackEnabled, hardcoverEnabled, paperbackBinding, interiorColor, printQuality, paperType, coverFinish, linenColor, foilColor],
  );

  // Reads the uploaded interior again whenever the file, the selected size or a print setting changes.
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      if (!printReadyPdfFileId) { setSpecReport(null); return; }
      setSpecBusy(true);
      const r = await analyzePrintInterior({ fileId: printReadyPdfFileId, chosenTrimCode: trimCode, ...specSettings }).catch(() => null);
      if (cancelled) return;
      setSpecBusy(false);
      if (r) {
        setSpecReport(r);
        // A replacement file (or a font fix) can change the page count: keep the Pages box in step when it was auto-detected.
        if (r.ok && typeof r.pageCount === "number" && pagesAutoRef.current) setPrintPages(String(r.pageCount));
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [printReadyPdfFileId, trimCode, specSettings]);

  const embedFonts = useCallback(async (approved: string[]) => {
    if (!printReadyPdfFileId) return;
    setFontBusy(true);
    const res = await fixPrintFonts({ fileId: printReadyPdfFileId, approved }).catch(() => ({ ok: false, error: "The fonts could not be embedded. Please try again.", embedded: [], skipped: [], remaining: [] }) as FixFontsResult);
    setFontBusy(false);
    setFontResult(res);
    if (res.ok && res.fileId) {
      setOriginalPdfFileId((o) => o ?? printReadyPdfFileId);
      autoFontTried.current = res.fileId;
      setCarriedFileName(res.fileName);
      setPrintReadyPdfFileId(res.fileId);
    }
  }, [printReadyPdfFileId]);

  // Fonts we have ourselves are embedded without asking. Stand-ins wait for the author's approval.
  useEffect(() => {
    if (!specReport?.ok || !printReadyPdfFileId || fontBusy) return;
    if (autoFontTried.current === printReadyPdfFileId) return;
    if (!specReport.fonts?.unembedded.some((f) => f.status === "auto")) return;
    autoFontTried.current = printReadyPdfFileId;
    const t = setTimeout(() => { void embedFonts([]); }, 0);
    return () => clearTimeout(t);
  }, [specReport, printReadyPdfFileId, fontBusy, embedFonts]);

  // Lulu's real printing cost for these exact specifications. It does not depend on the retail price,
  // so a price change only redoes the split below; a spec or page-count change asks Lulu again.
  const pagesNum = Number(printPages) || 0;
  const [costItems, setCostItems] = useState<Partial<Record<"paperback" | "hardcover", PrintCostItem>>>({});
  const [costBusy, setCostBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      if (!pagesNum || (!paperbackEnabled && !hardcoverEnabled)) { setCostItems({}); return; }
      setCostBusy(true);
      const r = await quotePrintCost({ trimCode, ...specSettings, pageCount: pagesNum }).catch(() => null);
      if (cancelled) return;
      setCostBusy(false);
      setCostItems(r?.ok ? Object.fromEntries(r.items.map((i) => [i.format, i])) : {});
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [pagesNum, trimCode, specSettings, paperbackEnabled, hardcoverEnabled]);

  const isbnError = isbnProblem(printIsbn);
  const barcodeIsbn = isbn13Of(printIsbn);
  const foilCharsUsed = foilStampTitleText.length + foilStampAuthorText.length;

  const paperbackPodId = buildPodPackageId({
    trimCode, colorCode: interiorColor, qualityCode: printQuality, bindingCode: paperbackBinding, paperCode: paperType, finishCode: coverFinish, linenCode: "X", foilCode: "X",
  });
  const hardcoverPodId = buildPodPackageId({
    trimCode, colorCode: interiorColor, qualityCode: printQuality, bindingCode: "LW", paperCode: paperType, finishCode: coverFinish, linenCode: linenColor, foilCode: foilColor,
  });

  const pbRetail = Number(paperbackRetailPrice) || 0;
  const hcRetail = Number(hardcoverRetailPrice) || 0;
  const pbItem = costItems.paperback;
  const hcItem = costItems.hardcover;
  const paperbackPricing = pbItem && pbItem.cost !== null ? computePrintPricingFromCost(pbRetail, pbItem.cost) : computePrintPricing(pbRetail, paperbackBinding as "PB" | "CO", pagesNum || undefined);
  const hardcoverPricing = hcItem && hcItem.cost !== null ? computePrintPricingFromCost(hcRetail, hcItem.cost) : computePrintPricing(hcRetail, "LW", pagesNum || undefined);
  const costLabel = (item: PrintCostItem | undefined) =>
    item?.source === "lulu" ? "Lulu's quote for your file's specs" : item?.source === "refused" ? "Lulu does not offer these settings" : pagesNum ? "Estimate: Lulu could not be asked" : "Estimate: upload your interior PDF to get Lulu's quote";
  // The price must cover Lulu's printing cost and leave the author a positive royalty. Publishing is blocked until it does.
  const priceProblems: string[] = [];
  if (paperbackEnabled) {
    if (pbItem?.source === "refused") priceProblems.push(`Paperback: ${pbItem.message}`);
    else { const r = checkPriceFloor(pbRetail, paperbackPricing.printingCost, "Paperback"); if (!r.ok && r.message) priceProblems.push(r.message); }
  }
  if (hardcoverEnabled) {
    if (hcItem?.source === "refused") priceProblems.push(`Hardcover: ${hcItem.message}`);
    else { const r = checkPriceFloor(hcRetail, hardcoverPricing.printingCost, "Hardcover"); if (!r.ok && r.message) priceProblems.push(r.message); }
  }
  const priceBlocked = priceProblems.length > 0 || costBusy;

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
        printReadyOriginalPdfFileId: originalPdfFileId,
        frontCoverImageUrl,
        customBackCoverPdfFileId,
        backCoverMode,
        printIsbn: printIsbn.trim() || undefined,
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
      {prefill && !editing && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-small btn-ghost"
            disabled={autofilling}
            title="Copy the title, description, cover image, author and the uploaded file from the eBook / Audiobook tab into this print edition"
            onClick={() => { void autofillFromEbook(); }}
          >
            {autofilling ? "Copying…" : "Autofill from eBook"}
          </button>
          <span className="field-hint" style={{ margin: 0 }}>
            Copies your eBook details, cover and uploaded file into this form. You can edit everything afterwards.
          </span>
        </div>
      )}
      {autofillNote && (
        <div className="field-hint" role="status" style={{ background: "var(--paper)", border: "1px solid var(--line)", borderRadius: 10, padding: "10px 14px", margin: 0 }}>
          {autofillNote}
        </div>
      )}
      {/* Section 1: Files come first, because everything below can be filled in while the files are checked. */}
      <Card>
        <SectionHeader n={1} title="Files" sub="The central upload area for all print assets. Print-ready files are validated automatically on upload." />
        <div className="upload-cards-row">
          <FileUploadField
            label="Print-Ready PDF"
            sizeHint="The complete interior pages of the book (PDF only)"
            allowedTypes={["application/pdf"]}
            accept=".pdf"
            initialFileName={initial?.printReadyPdfFileId ? "Print-ready PDF already uploaded" : undefined}
            externalFileName={printReadyPdfFileId ? carriedFileName : undefined}
            onUploaded={(ids) => { setPrintReadyPdfFileId(ids[0]); setCarriedFileName(undefined); setOriginalPdfFileId(undefined); setFontResult(null); autoFontTried.current = ""; }}
            onFileMeta={(results) => applyInteriorMeta(results[0])}
            fillWidth
          />
          <ImageUploadField
            label="Front Cover Only"
            recommendedSize="PNG or JPEG — automatically converted to WebP"
            value={frontCoverImageUrl}
            onChange={(url) => { setFrontCoverImageUrl(url); setBackCoverMode("auto"); }}
            externalLabel="Cover image ready"
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
        <PrintSpecsPanel
          report={specReport}
          busy={specBusy}
          chosenTrimCode={trimCode}
          onUseTrim={setTrimCode}
          fontBusy={fontBusy}
          fontResult={fontResult}
          onEmbed={(names) => { void embedFonts(names); }}
        />
        <p style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 8 }}>
          {backCoverMode === "custom"
            ? "Your uploaded wraparound cover (front, spine, and back) is the one that will be sent to Lulu — the auto-generated version won't be used."
            : "Upload only your professionally designed front cover. The matching spine and back cover are generated automatically from the dominant colour palette, book description, and ISBN already entered — this auto-generated wraparound is what gets sent to Lulu."}
        </p>
        <PreflightPanel
          hasFiles={hasPrintFiles}
          busy={preflightBusy}
          result={preflight}
          savedFromBook={unchangedSaved ? initial?.preflight : undefined}
          onRetry={() => { checkedKeys.current = ""; void runPreflight(); }}
        />

        {/* Interior: a page-by-page preview of the file as uploaded (it refreshes by itself when
            the file is replaced), with the site's checks and Lulu's verdict underneath. */}
        <div style={{ marginTop: 22 }}>
          <div className="preview-card">
          <h3 className="preview-card-title">Interior Preview</h3>
          {printReadyPdfFileId ? (
            <>
              <p className="preview-card-help">
                Read-only. This is the interior file as uploaded; page through it to check it.
              </p>
              <div className="preview-card-body"><ManuscriptReviewViewer key={printReadyPdfFileId} url={`/api/files/${printReadyPdfFileId}`} title={title || "Print interior preview"} spread theme="light" scale={2} /></div>
            </>
          ) : (
            <p className="preview-card-help" style={{ marginBottom: 0 }}>Upload the print-ready PDF above to preview it page by page.</p>
          )}
          </div>
          <FileVerdictBox
            title="Interior File Check"
            verdict={printReadyPdfFileId ? preflight?.interior : "NONE"}
            issues={(preflight?.issues ?? []).filter((i) => i.file === "interior")}
            saved={unchangedSaved && !preflight ? initial?.preflight : undefined}
          />
        </div>

        {/* Cover: the full wrap (back, spine, front), uploaded by the author or generated by the
            site. A generated wrap is rebuilt from the page count, so it is redrawn and re-checked
            whenever the interior file changes. */}
        <div style={{ marginTop: 22 }}>
          <div className="preview-card">
          <h3 className="preview-card-title">Full Wrap Cover Preview</h3>
          <p className="preview-card-help">
            {backCoverMode === "custom"
              ? "Your uploaded wraparound cover (back cover, spine and front)."
              : "Back cover, spine and front, generated by the site from your front cover. The spine width follows the page count, so this is redrawn and checked again whenever you replace the interior file."}
            {" "}Check the margin, bleed and fold guides.
          </p>
          {customBackCoverPdfFileId && (
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              <button type="button" className={`btn btn-small ${backCoverMode === "auto" ? "btn-primary" : "btn-ghost"}`} onClick={() => setBackCoverMode("auto")}>
                Auto-Generated Cover
              </button>
              <button type="button" className={`btn btn-small ${backCoverMode === "custom" ? "btn-primary" : "btn-ghost"}`} onClick={() => setBackCoverMode("custom")}>
                My Custom Cover
              </button>
            </div>
          )}
          <div className="preview-card-body">
          <CoverWrapPreview
            key={`${printReadyPdfFileId ?? ""}|${printPages}`}
            customCoverFileId={backCoverMode === "custom" ? customBackCoverPdfFileId : undefined}
            pages={Number(printPages) || 32}
            title={title}
            subtitle={subtitle}
            authorFirstName={authorFirstName}
            authorLastName={authorLastName}
            description={description}
            isbn={barcodeIsbn}
            trimCode={trimCode}
            paperCode={paperType}
            coverImageUrl={frontCoverImageUrl}
          />
          </div>
          </div>
          <FileVerdictBox
            title="Cover Check"
            verdict={frontCoverImageUrl || customBackCoverPdfFileId ? preflight?.cover : "NONE"}
            issues={(preflight?.issues ?? []).filter((i) => i.file === "cover")}
            saved={unchangedSaved && !preflight ? initial?.preflight : undefined}
          />
        </div>
      </Card>

      {/* Section 2 */}
      <Card>
        <SectionHeader n={2} title="Book Information" sub="Core bibliographic details for the print edition." />
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
            <input className="field" id="p-isbn" type="text" inputMode="numeric" placeholder="Enter your own ISBN (optional)" value={printIsbn} onChange={(e) => setPrintIsbn(e.target.value)} aria-invalid={!!isbnError} />
            {isbnError && <div className="field-hint" role="alert" style={{ color: "var(--coral-deep)" }}>{isbnError}</div>}
          </div>
          <ChoiceChips id="p-lang" label="Language" options={LANGUAGES} value={language} onChange={setLanguage} />
        </div>
        <PublisherField id="p-publisher" value={publisher} onChange={setPublisher} />
        <label className="field-label" htmlFor="p-pubdate">Publication date</label>
        <input className="field" id="p-pubdate" type="date" value={publicationDate} onChange={(e) => setPublicationDate(e.target.value)} />
        <ChoiceChips id="p-category" label="Category" options={CATEGORIES} value={category} onChange={(v) => { setCategory(v); setSubcategory(""); }} />
        <ChoiceChips id="p-genre" label="Genre" options={GENRES} value={genre} onChange={setGenre} />
        <ChoiceChips id="p-subcategory" label="Subcategory" options={subcategoriesFor(category)} value={subcategory} onChange={setSubcategory} disabled={!category} hint={category ? undefined : "Choose a category first."} />
        <div>
          <AgeGroupField id="p-age" value={ageGroup} onChange={setAgeGroup} />
        </div>
        <ChoiceChips id="p-readinglevel" label="Reading level" options={READING_LEVELS} value={readingLevel} onChange={setReadingLevel} />
        <label className="field-label" htmlFor="p-desc">Book description</label>
        <textarea className="field" id="p-desc" rows={6} placeholder="A short back-cover description of the book…" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div
          className="field-hint"
          style={descriptionWordCount > 200 ? { color: "var(--coral-deep)", fontWeight: 700 } : undefined}
        >
          {descriptionWordCount} / 200 words{descriptionWordCount > 200 ? " — over the limit, please shorten it" : ""}
        </div>
        <div style={{ marginTop: 14 }}>
          <AiDeclarationField id="p-ai-declaration" value={aiDeclaration} onChange={setAiDeclaration} legacyNote={isLegacyAiText(initial?.aiDeclaration) && !aiChoiceOf(aiDeclaration)} />
        </div>
      </Card>

      {/* Section 3 */}
      <Card>
        <SectionHeader n={3} title="Author Information" sub="The author name shown on this edition." />
        <div className="form-grid-2">
          <div>
            <label className="field-label" htmlFor="p-authfirst">First Name</label>
            <input className="field" id="p-authfirst" type="text" value={authorFirstName} onChange={(e) => setAuthorFirstName(e.target.value)} onBlur={() => setAuthorFirstName((v) => capitalizeName(v))} />
          </div>
          <div>
            <label className="field-label" htmlFor="p-authlast">Last Name</label>
            <input className="field" id="p-authlast" type="text" value={authorLastName} onChange={(e) => setAuthorLastName(e.target.value)} onBlur={() => setAuthorLastName((v) => capitalizeName(v))} />
          </div>
        </div>
      </Card>

      {/* Section 4 */}
      <Card>
        <SectionHeader n={4} title="Publication Format" sub="Choose Paperback, Hardcover, or both as separate printable editions of this title." />
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
        <SectionHeader n={5} title="Book Specifications" sub="Every option here maps directly to a Lulu Print API POD Package code." />
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
              onChange={(e) => { setPrintPages(e.target.value); markPagesAuto(false); }}
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
            <div><div className="stat-label">Paperback Printing Cost</div><div className="stat-value" style={{ fontSize: 20 }}>${paperbackPricing.printingCost.toFixed(2)}</div><div className="stat-sub">{costLabel(pbItem)}</div></div>
            <div><div className="stat-label">Company Revenue</div><div className="stat-value" style={{ fontSize: 20 }}>${paperbackPricing.companyRevenue.toFixed(2)}</div><div className="stat-sub">30% of ${paperbackPricing.balance.toFixed(2)} (price minus printing cost)</div></div>
            <div><div className="stat-label">Estimated Royalty</div><div className="stat-value" style={{ fontSize: 20 }}>${paperbackPricing.estimatedRoyalty.toFixed(2)}</div><div className="stat-sub">Per copy sold, 70% of the balance</div></div>
            <div><div className="stat-label">Royalty Via Affiliate Link</div><div className="stat-value" style={{ fontSize: 20 }}>${paperbackPricing.royaltyViaAffiliate.toFixed(2)}</div><div className="stat-sub">60% of the balance; the affiliate earns ${paperbackPricing.affiliateCommission.toFixed(2)}</div></div>
          </div>
        )}
        {hardcoverEnabled && (
          <div className="stat-grid" style={{ marginTop: paperbackEnabled ? 20 : 12, marginBottom: 0 }}>
            <div><div className="stat-label">Hardcover Printing Cost</div><div className="stat-value" style={{ fontSize: 20 }}>${hardcoverPricing.printingCost.toFixed(2)}</div><div className="stat-sub">{costLabel(hcItem)}</div></div>
            <div><div className="stat-label">Company Revenue</div><div className="stat-value" style={{ fontSize: 20 }}>${hardcoverPricing.companyRevenue.toFixed(2)}</div><div className="stat-sub">30% of ${hardcoverPricing.balance.toFixed(2)} (price minus printing cost)</div></div>
            <div><div className="stat-label">Estimated Royalty</div><div className="stat-value" style={{ fontSize: 20 }}>${hardcoverPricing.estimatedRoyalty.toFixed(2)}</div><div className="stat-sub">Per copy sold, 70% of the balance</div></div>
            <div><div className="stat-label">Royalty Via Affiliate Link</div><div className="stat-value" style={{ fontSize: 20 }}>${hardcoverPricing.royaltyViaAffiliate.toFixed(2)}</div><div className="stat-sub">60% of the balance; the affiliate earns ${hardcoverPricing.affiliateCommission.toFixed(2)}</div></div>
          </div>
        )}
              {costBusy && <p role="status" className="field-hint" style={{ marginTop: 10 }}>Asking Lulu for the printing cost of your file&apos;s specifications…</p>}
        {priceProblems.length > 0 && (
          <div role="alert" className="field-hint" style={{ marginTop: 10, color: "var(--coral-deep)" }}>
            {priceProblems.map((m) => <p key={m} style={{ margin: "0 0 6px" }}><strong>Price too low.</strong> {m}</p>)}
            <p style={{ margin: 0 }}>Publishing is blocked until this is fixed.</p>
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
            {!initial && prefill && <AffiliateCopyOffer from="eBook and Audiobook" value={prefill.affiliateEligible} current={affiliateEligiblePrint} onCopy={setAffiliateEligiblePrint} />}
          </div>
        </div>
      </Card>

      {/* Section 10 */}
      <Card>
        <SectionHeader n={8} title="ISBN Barcode" sub="Made from your ISBN as soon as it is valid. Download it to place on your own back cover." />
        {barcodeIsbn ? <Ean13Barcode isbn={barcodeIsbn} /> : <p className="field-hint">Enter a valid ISBN in Book Information and its barcode appears here, with PNG and SVG downloads you can place on your own back cover.</p>}
      </Card>

      {error && <div className="field-hint" style={{ color: "var(--coral-deep)" }}>{error}</div>}
      <div>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          className="btn btn-primary btn-small"
          disabled={submitting || !!ageGroupProblem(ageGroup) || !preflightPassed || !aiChoiceOf(aiDeclaration) || priceBlocked || fontBusy || !!isbnError}
          onClick={() => handleSubmit(true)}
        >
          {submitting
            ? (editing ? "Saving…" : "Submitting…")
            : editing
            ? (editingPublished ? "Save Changes" : "Save and Resubmit for Review")
            : "Submit Print Copy"}
        </button>
        {extraActions}
        </div>
        {!aiChoiceOf(aiDeclaration) && (
          <div className="field-hint" style={{ marginTop: 6 }}>Tick one AI use box in the Book Information section first.</div>
        )}
        {priceBlocked && (
          <div className="field-hint" role="alert" style={{ marginTop: 6 }}>
            {costBusy ? "Waiting for Lulu's printing cost…" : "Publishing is blocked until the price in the Pricing section covers Lulu's printing cost and leaves you a royalty."}
          </div>
        )}
        {fontBusy && <div className="field-hint" style={{ marginTop: 6 }}>Waiting for the fonts to finish embedding…</div>}
        {!preflightPassed && (
          <div className="field-hint" style={{ marginTop: 6 }}>
            {!hasPrintFiles
              ? "Upload the print-ready PDF and a cover in the Files section first; they are checked for printing straight away."
              : preflight?.status === "FAILED"
              ? `Publishing is blocked until ${[preflight.interior === "FAILED" && "the interior file", preflight.cover === "FAILED" && "the cover"].filter(Boolean).join(" and ") || "the print files"} ${preflight.interior === "FAILED" && preflight.cover === "FAILED" ? "are" : "is"} replaced with a file that passes the check above.`
              : "Waiting for the print file check above to finish."}
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  PASSED: { bg: "#E3F5EA", fg: "#165236", label: "Passed" },
  FAILED: { bg: "#FCE4E4", fg: "#6F1A28", label: "Needs fixing" },
  CHECKING: { bg: "#FFF3D6", fg: "#6E4A00", label: "Checking…" },
  UNAVAILABLE: { bg: "#EEE9F6", fg: "#3F3350", label: "Could not finish" },
};

/** The print file check result, in plain language, right inside the Print tab. */
function PreflightPanel({ hasFiles, busy, result, savedFromBook, onRetry }: {
  hasFiles: boolean;
  busy: boolean;
  result: PrintPreflightView | null;
  savedFromBook?: SavedPreflight;
  onRetry: () => void;
}) {
  const status = busy && !result ? "CHECKING" : result?.status ?? (savedFromBook ? savedFromBook.status : undefined);
  const style = status ? STATUS_STYLE[status] : undefined;
  return (
    <div style={{ marginTop: 14, border: "1px solid var(--line)", borderRadius: 12, padding: "14px 16px", background: "var(--paper)" }} aria-live="polite">
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>Print file check</strong>
        {style && <span style={{ background: style.bg, color: style.fg, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{style.label}</span>}
        {hasFiles && status !== "CHECKING" && (
          <button type="button" className="btn btn-ghost btn-small" onClick={onRetry} disabled={busy}>Check Again</button>
        )}
      </div>
      {!hasFiles && (
        <p className="field-hint" style={{ margin: "8px 0 0" }}>
          As soon as the print-ready PDF and a cover are uploaded, we check them for printing: embedded fonts, page size, page count and cover size, and then our print partner (Lulu) checks them too. Nothing is ordered or printed by this check.
        </p>
      )}
      {hasFiles && status === "CHECKING" && (
        <p className="field-hint" style={{ margin: "8px 0 0" }}>
          Checking your files with our print partner. This usually takes under a minute; you can keep filling in the form.
        </p>
      )}
      {status === "PASSED" && (
        <p className="field-hint" style={{ margin: "8px 0 0", color: "#165236" }}>
          Your print files meet our print partner&apos;s standards. {savedFromBook && !result ? `Checked ${new Date(savedFromBook.checkedAt).toLocaleDateString()}.` : ""}
        </p>
      )}
      {result?.error && <p className="field-hint" style={{ margin: "8px 0 0", color: "var(--coral-deep)" }}>{result.error}</p>}
      {result?.issues && result.issues.some((i) => i.file === "both") && (
        <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13 }}>
          {result.issues.filter((i) => i.file === "both").map((i, n) => (
            <li key={n} style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 600 }}>{i.message}</div>
              <div style={{ color: "var(--ink-soft)" }}>How to fix it: {i.fix}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const VERDICT_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  PASSED: { bg: "#E3F5EA", fg: "#165236", label: "Passed" },
  FAILED: { bg: "#FCE4E4", fg: "#6F1A28", label: "Rejected" },
  CHECKING: { bg: "#FFF3D6", fg: "#6E4A00", label: "Checking…" },
  UNAVAILABLE: { bg: "#EEE9F6", fg: "#3F3350", label: "Could not finish" },
  WAITING: { bg: "#EEE9F6", fg: "#3F3350", label: "Waiting for the other file" },
};

/** The result for ONE file, shown directly under its preview: the site's own checks and
 * Lulu's verdict, with the reasons and how to fix each, in plain language. */
function FileVerdictBox({ title, verdict, issues, saved }: {
  title: string;
  verdict?: "PASSED" | "FAILED" | "CHECKING" | "UNAVAILABLE" | "WAITING" | "NONE";
  issues: { source: "site" | "lulu"; message: string; fix: string }[];
  saved?: SavedPreflight;
}) {
  const shown = verdict && verdict !== "NONE" ? verdict : saved ? saved.status : undefined;
  const style = shown ? VERDICT_STYLE[shown] : undefined;
  return (
    <div style={{ marginTop: 12, border: "1px solid var(--line)", borderRadius: 12, padding: "12px 16px", background: "var(--paper)" }} aria-live="polite">
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <strong style={{ fontSize: 14 }}>{title}</strong>
        {style && <span style={{ background: style.bg, color: style.fg, borderRadius: 999, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{style.label}</span>}
      </div>
      {!style && <p className="field-hint" style={{ margin: "8px 0 0" }}>Checked automatically as soon as the file is uploaded.</p>}
      {shown === "PASSED" && (
        <p className="field-hint" style={{ margin: "8px 0 0", color: "#165236" }}>Our checks and Lulu&apos;s file validation both passed.</p>
      )}
      {shown === "CHECKING" && <p className="field-hint" style={{ margin: "8px 0 0" }}>Lulu is checking this file. This usually takes under a minute.</p>}
      {shown === "WAITING" && <p className="field-hint" style={{ margin: "8px 0 0" }}>This file is sent to Lulu once the other file&apos;s problems are fixed.</p>}
      {issues.length > 0 && (
        <ul style={{ margin: "10px 0 0", paddingLeft: 18, fontSize: 13 }}>
          {issues.map((i, n) => (
            <li key={n} style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 600 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-faint)", marginRight: 6 }}>{i.source === "lulu" ? "LULU" : "OUR CHECK"}</span>
                {i.message}
              </div>
              <div style={{ color: "var(--ink-soft)" }}>How to fix it: {i.fix}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
