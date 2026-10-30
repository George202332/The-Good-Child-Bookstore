/**
 * Print pre-flight: the site's own quick checks on a print edition's files,
 * before anything is sent to Lulu. These cover the things Lulu rejects most
 * often, and each failure says in plain words what is wrong and how to fix it:
 *
 *   - fonts not embedded in the interior PDF
 *   - page size not matching the chosen trim size
 *   - page count not valid for the binding
 *   - cover dimensions not matching the cover specification
 *
 * Lulu's own validation (lib/payments/lulu.ts) runs after these and has the final
 * word. Everything here is pure or works on PDF bytes, so it can be unit tested
 * without a network.
 */

import type { PDFDocument as PDFDocumentT } from "pdf-lib";
import { LULU_CONFIG } from "@/lib/lulu-config";
import { detectTrimFromPageSize, formatInches, trimCodeToInches } from "@/lib/trim-size";

export interface PreflightIssue {
  code: "ENCRYPTED" | "UNREADABLE" | "FONTS" | "PAGE_SIZE" | "PAGE_COUNT" | "COVER_SIZE" | "COVER_MISSING" | "COVER_UNREADABLE" | "NOT_PDF" | "LULU" | "UNAVAILABLE";
  /** What is wrong, in plain words. */
  message: string;
  /** How to fix it. */
  fix: string;
}

// ---------------------------------------------------------------------------
// Page count for the binding
// ---------------------------------------------------------------------------

export interface PageLimits { min: number; max: number }

/** Page limits per Lulu binding code. Hardcover (linen wrap) and perfect-bound
 * paperbacks follow Lulu's published ranges; coil uses the limit already in the
 * site's print configuration. Lulu's own check is still the final word. */
export function pageLimitsForBinding(bindingCode: string): PageLimits {
  switch (bindingCode) {
    case "LW": return { min: 24, max: 800 };
    case "CO": return { min: 18, max: LULU_CONFIG.bindings.find((b) => b.code === "CO")?.maxPages ?? 275 };
    default: return { min: 32, max: 800 };
  }
}

export function bindingLabel(bindingCode: string): string {
  return LULU_CONFIG.bindings.find((b) => b.code === bindingCode)?.label ?? bindingCode;
}

export function checkPageCount(pageCount: number, bindingCode: string): PreflightIssue | null {
  const { min, max } = pageLimitsForBinding(bindingCode);
  if (pageCount < min) {
    return {
      code: "PAGE_COUNT",
      message: `The interior has ${pageCount} page${pageCount === 1 ? "" : "s"}, but ${bindingLabel(bindingCode)} needs at least ${min}.`,
      fix: `Add pages (for example blank or "notes" pages at the back) so the PDF has at least ${min}, then upload it again.`,
    };
  }
  if (pageCount > max) {
    return {
      code: "PAGE_COUNT",
      message: `The interior has ${pageCount} pages, but ${bindingLabel(bindingCode)} allows at most ${max}.`,
      fix: `Reduce the book to ${max} pages or fewer, or choose a different binding.`,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Page size for the trim size
// ---------------------------------------------------------------------------

/** Compares every page size against the chosen trim size (exact, or with bleed). */
export function checkPageSizes(pages: { widthIn: number; heightIn: number }[], trimCode: string): PreflightIssue | null {
  const trim = trimCodeToInches(trimCode);
  const label = LULU_CONFIG.trimSizes.find((t) => t.code === trimCode)?.label ?? trimCode;
  if (!trim || pages.length === 0) return null;
  const first = pages[0];
  const found = detectTrimFromPageSize(first.widthIn, first.heightIn, LULU_CONFIG.trimSizes);
  if (!found) {
    return {
      code: "PAGE_SIZE",
      message: `The pages are ${formatInches(first.widthIn, first.heightIn)}, which is not a size Lulu can print (the chosen trim size is ${label}).`,
      fix: `Re-export the PDF at exactly ${label} (or ${label} plus 0.125 in bleed) and upload it again.`,
    };
  }
  if (found.code !== trimCode) {
    return {
      code: "PAGE_SIZE",
      message: `The pages are ${found.label}, but the trim size chosen for this book is ${label}.`,
      fix: `Either pick ${found.label} as the trim size, or re-export the PDF at ${label}.`,
    };
  }
  // Every page must match the first page's size.
  const odd = pages.findIndex((p) => Math.abs(p.widthIn - first.widthIn) > 0.04 || Math.abs(p.heightIn - first.heightIn) > 0.04);
  if (odd > 0) {
    const p = pages[odd];
    return {
      code: "PAGE_SIZE",
      message: `Page ${odd + 1} is ${formatInches(p.widthIn, p.heightIn)} but page 1 is ${formatInches(first.widthIn, first.heightIn)}. Every page must be the same size.`,
      fix: "Re-export the PDF so every page uses the same page size, then upload it again.",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Cover dimensions
// ---------------------------------------------------------------------------

const COVER_TOLERANCE_PT = 4; // about 1.4 mm

/** The uploaded full-wrap cover against the size the cover specification gives
 * for this book (Lulu's cover-dimensions, in points). */
export function checkCoverSize(actual: { widthPt: number; heightPt: number }, expected: { widthPt: number; heightPt: number }): PreflightIssue | null {
  const dw = Math.abs(actual.widthPt - expected.widthPt);
  const dh = Math.abs(actual.heightPt - expected.heightPt);
  if (dw <= COVER_TOLERANCE_PT && dh <= COVER_TOLERANCE_PT) return null;
  const inch = (pt: number) => formatInches(pt / 72, 0).split(" x ")[0];
  return {
    code: "COVER_SIZE",
    message: `Your cover is ${inch(actual.widthPt)} x ${inch(actual.heightPt)} in, but the cover for this book (back + spine + front, with bleed) must be ${inch(expected.widthPt)} x ${inch(expected.heightPt)} in.`,
    fix: "Re-export the full wraparound cover at exactly that size (the spine width depends on the page count), or remove the custom cover and let us build one from your front cover image.",
  };
}

// ---------------------------------------------------------------------------
// Fonts embedded
// ---------------------------------------------------------------------------

export interface PdfInspection {
  pageCount: number;
  pages: { widthIn: number; heightIn: number }[];
  /** Names of fonts used on pages that are not embedded in the file. */
  unembeddedFonts: string[];
}


/** Opens a PDF and reads page sizes plus which fonts are not embedded. Throws
 * "ENCRYPTED" or "UNREADABLE" (as the message) when the file cannot be read. */
export async function inspectPdf(bytes: Uint8Array): Promise<PdfInspection> {
  const { PDFDocument } = await import("pdf-lib");
  let doc: PDFDocumentT;
  try {
    doc = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  } catch (e) {
    const name = e instanceof Error ? e.constructor.name + " " + e.message : "";
    if (/encrypt/i.test(name)) throw new Error("ENCRYPTED");
    throw new Error("UNREADABLE");
  }

  const pdfPages = doc.getPages();
  const pages = pdfPages.map((p) => {
    const { width, height } = p.getSize();
    return { widthIn: width / 72, heightIn: height / 72 };
  });

  const { scanFonts } = await import("@/lib/pdf-font-scan");
  const unembedded = new Set<string>();
  for (const f of await scanFonts(doc)) if (!f.embedded) unembedded.add(f.name);

  return { pageCount: pdfPages.length, pages, unembeddedFonts: [...unembedded].sort() };
}

export function fontIssue(unembedded: string[]): PreflightIssue | null {
  if (unembedded.length === 0) return null;
  const shown = unembedded.slice(0, 5).join(", ") + (unembedded.length > 5 ? ` and ${unembedded.length - 5} more` : "");
  return {
    code: "FONTS",
    message: `Fonts are not embedded in the PDF: ${shown}. Lulu rejects files whose fonts are not embedded.`,
    fix: "Re-export your PDF with all fonts embedded (in Word: File > Save As > PDF > Options > tick \"ISO 19005-1 compliant (PDF/A)\"; in InDesign choose the PDF/X-1a or \"Press Quality\" preset; in Canva choose PDF Print), then upload it again.",
  };
}

/** The site's own interior checks, in order: readable, fonts, page size, page count. */
export async function runInteriorChecks(bytes: Uint8Array, opts: { trimCode: string; bindingCodes: string[] }): Promise<{ issues: PreflightIssue[]; pageCount: number | null }> {
  let info: PdfInspection;
  try {
    info = await inspectPdf(bytes);
  } catch (e) {
    const reason = e instanceof Error ? e.message : "";
    return {
      pageCount: null,
      issues: [reason === "ENCRYPTED"
        ? { code: "ENCRYPTED", message: "The PDF is password-protected, so it cannot be checked or printed.", fix: "Export the PDF again without a password or encryption and upload it." }
        : { code: "UNREADABLE", message: "The PDF could not be read - it may be damaged.", fix: "Open the file on your computer to make sure it displays correctly, export it again as a PDF, and upload it." }],
    };
  }
  const issues: PreflightIssue[] = [];
  const f = fontIssue(info.unembeddedFonts);
  if (f) issues.push(f);
  const sz = checkPageSizes(info.pages, opts.trimCode);
  if (sz) issues.push(sz);
  for (const code of opts.bindingCodes) {
    const pc = checkPageCount(info.pageCount, code);
    if (pc) issues.push({ ...pc, message: pc.message });
  }
  return { issues, pageCount: info.pageCount };
}

/** Turns an issue list into the short strings stored on the book. */
export function issuesToReasons(issues: PreflightIssue[]): string[] {
  return issues.map((i) => `${i.message} ${i.fix}`.trim());
}
