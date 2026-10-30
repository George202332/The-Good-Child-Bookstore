"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { packagesFor, type PackageSettings } from "@/lib/print-preflight-packages";
import { detectTrimFromPageSize, formatInches, trimCodeToInches } from "@/lib/trim-size";
import { evaluateTrim, recommendTrim, trimLabel, unsupportedSizeMessage, type TrimEvaluation } from "@/lib/print-specs";
import { planFontFixes, embedMissingFonts, type FontFixItem } from "@/lib/pdf-fonts";
import { scanFonts } from "@/lib/pdf-font-scan";
import { coverLayout } from "@/lib/lulu-cover";
import { estimatePrintingCost } from "@/lib/lulu-pricing";
import { luluExpectedCoverSize, quotePrintingCostPerCopy } from "@/lib/payments/lulu";

/**
 * Reads a print book's specifications from the uploaded interior PDF (page count, page size and
 * trim size, fonts, cover size), judges the detected size against the size the author selected,
 * asks Lulu for the real printing cost, and embeds missing fonts. Nothing here creates a Lulu print
 * job or order. Every call is short, so none waits on Lulu for long.
 */

type Settings = Omit<PackageSettings, "trimCode">;

export interface PrintSpecInput extends Settings {
  fileId: string;
  /** The trim size currently selected in the form. */
  chosenTrimCode: string;
}

export interface CoverSpec { format: "paperback" | "hardcover"; widthIn: number; heightIn: number; spineIn: number }

export interface PrintSpecReport {
  ok: boolean;
  error?: string;
  pageCount?: number;
  pageSizeLabel?: string;
  pageWidthIn?: number;
  pageHeightIn?: number;
  detectedTrim: { code: string; label: string; withBleed: boolean } | null;
  /** Set when the page size matches no size Lulu prints. */
  unsupportedMessage?: string;
  fonts?: { total: number; unembedded: FontFixItem[] };
  /** The size of the full cover wrap Lulu needs for this book, for each enabled format. */
  cover?: CoverSpec[];
  /** The detected size (when there is one) and the selected size, each judged. */
  candidates?: TrimEvaluation[];
  recommendedTrimCode?: string | null;
  recommendation?: string;
  /** False when Lulu could not be asked (not set up, or offline): the checks that need Lulu were skipped. */
  luluChecked?: boolean;
}

async function requireAuthor() {
  const session = await auth();
  return session?.user?.role === "AUTHOR" ? session.user : null;
}

const MAX_FIX_BYTES = 25 * 1024 * 1024;

export async function analyzePrintInterior(input: PrintSpecInput): Promise<PrintSpecReport> {
  const empty = { detectedTrim: null };
  if (!(await requireAuthor())) return { ok: false, error: "Only author accounts can check print files.", ...empty };
  const file = await prisma.uploadedFile.findUnique({ where: { id: input.fileId } });
  if (!file || file.mimeType !== "application/pdf") return { ok: false, error: "The interior must be an uploaded PDF.", ...empty };

  const { PDFDocument } = await import("pdf-lib");
  let doc;
  try {
    doc = await PDFDocument.load(new Uint8Array(file.data), { ignoreEncryption: false, updateMetadata: false });
  } catch (e) {
    const encrypted = /encrypt/i.test(e instanceof Error ? e.message : "");
    return { ok: false, error: encrypted ? "The PDF is password-protected, so its details cannot be read." : "The PDF could not be read, it may be damaged.", ...empty };
  }
  const pages = doc.getPages().map((p) => { const { width, height } = p.getSize(); return { widthIn: width / 72, heightIn: height / 72 }; });
  const pageCount = pages.length;
  const first = pages[0];
  if (!first) return { ok: false, error: "The PDF has no pages.", ...empty };

  const fontList = await scanFonts(doc);
  const fonts = { total: new Set(fontList.map((f) => f.name)).size, unembedded: planFontFixes(fontList) };

  const { LULU_CONFIG } = await import("@/lib/lulu-config");
  const detected = detectTrimFromPageSize(first.widthIn, first.heightIn, LULU_CONFIG.trimSizes);
  const settings: Settings = input;
  const bindingCodes = packagesFor({ ...settings, trimCode: input.chosenTrimCode }).map((p) => p.bindingCode);

  // Lulu's answer for a trim size: does it offer these settings at this page count?
  let luluChecked = false;
  const luluAccepts = async (trimCode: string): Promise<boolean | null> => {
    const pk = packagesFor({ ...settings, trimCode });
    if (pk.length === 0) return null;
    const answers = await Promise.all(pk.map((p) => quotePrintingCostPerCopy(p.packageId, pageCount)));
    if (answers.some((a) => !a.ok && a.rejected)) { luluChecked = true; return false; }
    if (answers.every((a) => a.ok)) { luluChecked = true; return true; }
    return null;
  };
  const evaluate = async (trimCode: string) => evaluateTrim({ trimCode, pages, pageCount, bindingCodes, luluAccepts: await luluAccepts(trimCode) });

  const candidates: TrimEvaluation[] = [];
  let detectedEval: TrimEvaluation | null = null;
  if (detected) { detectedEval = await evaluate(detected.code); candidates.push(detectedEval); }
  const chosenEval = detected && detected.code === input.chosenTrimCode && detectedEval ? detectedEval : await evaluate(input.chosenTrimCode);
  if (!candidates.includes(chosenEval)) candidates.push(chosenEval);
  const rec = recommendTrim(detectedEval, chosenEval);

  // Cover size for the size that will be used (the recommended one, else the one selected).
  const coverTrim = rec.recommendedCode ?? input.chosenTrimCode;
  const trim = trimCodeToInches(coverTrim);
  const cover: CoverSpec[] = [];
  if (trim) {
    for (const p of packagesFor({ ...settings, trimCode: coverTrim })) {
      const dims = await luluExpectedCoverSize(p.packageId, pageCount);
      const layout = dims ? coverLayout(dims.widthPt, dims.heightPt, trim.w, trim.h) : null;
      if (dims && layout) cover.push({ format: p.format, widthIn: +(dims.widthPt / 72).toFixed(3), heightIn: +(dims.heightPt / 72).toFixed(3), spineIn: +(layout.spine / 72).toFixed(3) });
    }
  }

  return {
    ok: true,
    pageCount,
    pageSizeLabel: formatInches(first.widthIn, first.heightIn),
    pageWidthIn: first.widthIn,
    pageHeightIn: first.heightIn,
    detectedTrim: detected ? { code: detected.code, label: detected.label, withBleed: detected.withBleed } : null,
    unsupportedMessage: detected ? undefined : unsupportedSizeMessage(first.widthIn, first.heightIn),
    fonts,
    cover,
    candidates,
    recommendedTrimCode: rec.recommendedCode,
    recommendation: detected ? rec.message : unsupportedSizeMessage(first.widthIn, first.heightIn),
    luluChecked,
  };
}

export interface FixFontsResult {
  ok: boolean;
  error?: string;
  /** The new file with fonts embedded; the original upload is untouched. */
  fileId?: string;
  fileName?: string;
  embedded: { name: string; substitute: string; sameWidths: boolean }[];
  /** Fonts left alone, each with the plain reason. */
  skipped: FontFixItem[];
  remaining: string[];
  pageCountBefore?: number;
  pageCountAfter?: number;
  /** The one-line note to show the author. */
  note?: string;
}

/** Embeds the fonts that can be embedded in a copy of the uploaded PDF. `approved` names the fonts the
 * author agreed to have replaced by a stand-in. The original upload is never changed. */
export async function fixPrintFonts(input: { fileId: string; approved: string[] }): Promise<FixFontsResult> {
  const none = { embedded: [], skipped: [], remaining: [] };
  if (!(await requireAuthor())) return { ok: false, error: "Only author accounts can fix print files.", ...none };
  const file = await prisma.uploadedFile.findUnique({ where: { id: input.fileId } });
  if (!file || file.mimeType !== "application/pdf") return { ok: false, error: "The interior must be an uploaded PDF.", ...none };
  if (file.data.length > MAX_FIX_BYTES) return { ok: false, error: "This PDF is too large for us to embed the fonts automatically. Re-export it with fonts embedded.", ...none };
  try {
    const { PDFDocument } = await import("pdf-lib");
    const before = (await PDFDocument.load(new Uint8Array(file.data), { updateMetadata: false })).getPageCount();
    const result = await embedMissingFonts(new Uint8Array(file.data), input.approved ?? []);
    if (result.embedded.length === 0) {
      return { ok: true, embedded: [], skipped: result.skipped, remaining: result.remaining, pageCountBefore: before, pageCountAfter: before, note: "No font could be embedded automatically." };
    }
    const after = (await PDFDocument.load(result.bytes, { updateMetadata: false })).getPageCount();
    const base = file.originalName.replace(/\.pdf$/i, "");
    const saved = await prisma.uploadedFile.create({
      data: { data: Uint8Array.from(result.bytes), mimeType: "application/pdf", originalName: `${base} (fonts embedded).pdf` },
    });
    const names = result.embedded.map((e) => e.name).join(", ");
    return {
      ok: true,
      fileId: saved.id,
      fileName: `${base} (fonts embedded).pdf`,
      embedded: result.embedded,
      skipped: result.skipped,
      remaining: result.remaining,
      pageCountBefore: before,
      pageCountAfter: after,
      note: `Fonts were embedded for you (${names}). Your original file was kept as it was.`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    return { ok: false, error: /encrypt/i.test(msg) ? "The PDF is password-protected, so fonts cannot be embedded." : "The fonts could not be embedded in this PDF. Re-export it with fonts embedded.", ...none };
  }
}

export interface PrintCostInput extends PackageSettings { pageCount: number }
export interface PrintCostItem {
  format: "paperback" | "hardcover";
  /** Per-copy production printing cost; null when Lulu says it does not offer this combination. */
  cost: number | null;
  /** "lulu" = Lulu's live quote for these exact specs; "estimate" = the site's estimate because Lulu could not be asked. */
  source: "lulu" | "estimate" | "refused";
  message?: string;
}

/** Lulu's real printing cost per copy for the detected specs, for each enabled print format. Falls back to the
 * site's labelled estimate only when Lulu cannot be asked; never silently. */
export async function quotePrintCost(input: PrintCostInput): Promise<{ ok: boolean; error?: string; items: PrintCostItem[] }> {
  if (!(await requireAuthor())) return { ok: false, error: "Only author accounts can price print books.", items: [] };
  if (!(input.pageCount > 0)) return { ok: false, error: "Upload the interior PDF first, so the page count is known.", items: [] };
  const items = await Promise.all(packagesFor(input).map(async (p): Promise<PrintCostItem> => {
    const q = await quotePrintingCostPerCopy(p.packageId, input.pageCount);
    if (q.ok) return { format: p.format, cost: q.cost, source: "lulu" };
    if (q.rejected) return { format: p.format, cost: null, source: "refused", message: `Lulu does not offer ${trimLabel(input.trimCode)} ${p.format} with these settings at ${input.pageCount} pages.` };
    return { format: p.format, cost: estimatePrintingCost(p.bindingCode as "PB" | "CO" | "LW", input.pageCount), source: "estimate", message: "Lulu could not be asked right now, so this is the site's estimate, not Lulu's quote." };
  }));
  return { ok: true, items };
}
