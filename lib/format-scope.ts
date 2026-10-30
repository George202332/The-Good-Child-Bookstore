/**
 * Each format of a book (eBook, Audiobook, Print) is edited on its own tab, and
 * saving one must never change, hide or overwrite another. This is the one rule
 * every save path uses to decide which fields it may write.
 *
 *   scope "digital" (the eBook / Audiobook form) writes the eBook and audiobook
 *                    fields and leaves every print field exactly as stored.
 *   scope "print"    (the Print form) writes the print fields and leaves every
 *                    eBook and audiobook field exactly as stored.
 *
 * The bug this replaces: the save paths wrote ALL of these fields from whichever form
 * was open, so a print save wrote "no eBook, no eBook price" over a book that had one,
 * and an eBook save wrote "no print, no print prices" over a book that had print.
 */

export type EditScope = "digital" | "print";

export interface FormatFields {
  hasEbook: boolean;
  ebookPrice: unknown;
  hasAudiobook: boolean;
  audiobookPrice: unknown;
  hasPrint: boolean;
  paperbackPrice: unknown;
  hardcoverPrice: unknown;
}

export function scopeOf(formats: { print: boolean }): EditScope {
  return formats.print ? "print" : "digital";
}

/** The format fields to store: the form's own scope from `incoming`, everything else from `existing`. */
export function mergeFormatFields(scope: EditScope, existing: FormatFields, incoming: FormatFields): FormatFields {
  if (scope === "digital") {
    return {
      hasEbook: incoming.hasEbook,
      ebookPrice: incoming.ebookPrice,
      hasAudiobook: incoming.hasAudiobook,
      audiobookPrice: incoming.audiobookPrice,
      hasPrint: existing.hasPrint,
      paperbackPrice: existing.paperbackPrice,
      hardcoverPrice: existing.hardcoverPrice,
    };
  }
  return {
    hasEbook: existing.hasEbook,
    ebookPrice: existing.ebookPrice,
    hasAudiobook: existing.hasAudiobook,
    audiobookPrice: existing.audiobookPrice,
    hasPrint: incoming.hasPrint,
    paperbackPrice: incoming.paperbackPrice,
    hardcoverPrice: incoming.hardcoverPrice,
  };
}

/** Metadata keys that belong to the print edition (kept when the eBook form saves). */
export const PRINT_METADATA_KEYS = [
  "interiorColor", "printQuality", "binding", "paperType", "coverFinish", "linenColor", "foilColor",
  "trimSizeCode", "podPackageId", "paperbackEnabled", "hardcoverEnabled", "paperbackRetailPrice",
  "hardcoverRetailPrice", "foilStampTitleText", "foilStampAuthorText", "printReadyPdfFileId", "printReadyOriginalPdfFileId",
  "frontCoverImageUrl", "customBackCoverPdfFileId", "backCoverMode", "sellThroughWebsite",
  "luluGlobalDistribution", "privatePrinting", "affiliateEligiblePrint", "promotionalCampaignEligible",
  "printPreflight", "printIsbns", "printIsbn",
] as const;

/** Metadata keys that belong to the eBook / audiobook edition (kept when the Print form saves). */
export const DIGITAL_METADATA_KEYS = [
  "fileSizeKB", "audiobookEnabled", "audiobookLive", "audiobookRetailPrice", "narrator", "keywords", "seriesNumber",
  "longDescriptionHtml", "authorBio", "copyrightYear", "copyrightHolder", "originalPublicationDate",
] as const;

/** `incoming` metadata, with the keys of the format the form does NOT own restored from `existing`. */
export function mergeMetadata(scope: EditScope, existing: Record<string, unknown> | null | undefined, incoming: Record<string, unknown>): Record<string, unknown> {
  const keep = scope === "digital" ? PRINT_METADATA_KEYS : DIGITAL_METADATA_KEYS;
  const out: Record<string, unknown> = { ...incoming };
  for (const k of keep) {
    if (existing && existing[k] !== undefined) out[k] = existing[k];
    else delete out[k];
  }
  return out;
}
