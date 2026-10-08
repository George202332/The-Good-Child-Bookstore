/**
 * Pure rules for which formats an eBook / Audiobook submission carries.
 * The manuscript (eBook) and the audiobook file are fully independent: a
 * title may have either one or both, but at least one of the two.
 *
 *  - manuscript present  -> hasEbook, and a list price > 0 is required
 *  - audiobook present   -> hasAudiobook, and an audiobook price > 0 is required
 *  - no manuscript       -> ebookPrice is null (never required, never stored)
 *  - no audiobook        -> audiobookPrice is null
 *  - basePrice (Book.price, a required column): the eBook price when an
 *    eBook exists, otherwise the audiobook price.
 */

export const NO_FILES_ERROR = "Upload a manuscript or an audiobook file.";
export const EBOOK_PRICE_ERROR = "Price must be greater than $0.";
export const AUDIOBOOK_PRICE_ERROR = "Audiobook price must be greater than $0 when an audiobook file is attached.";

export interface ResolveFormatsInput {
  manuscriptFileId?: string | null;
  audiobookFileId?: string | null;
  ebookPrice?: number | string | null;
  audiobookPrice?: number | string | null;
  /** When false the "neither file" error is not raised (print-only
   * submissions carry their own files). Defaults to true. */
  requireFile?: boolean;
}

export interface ResolvedFormats {
  hasEbook: boolean;
  hasAudiobook: boolean;
  /** Null when there is no eBook. */
  ebookPrice: number | null;
  /** Null when there is no audiobook. */
  audiobookPrice: number | null;
  /** Value for Book.price; null only when it cannot be determined (errors). */
  basePrice: number | null;
  errors: string[];
}

function positivePrice(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function resolveFormats(input: ResolveFormatsInput): ResolvedFormats {
  const hasEbook = !!input.manuscriptFileId;
  const hasAudiobook = !!input.audiobookFileId;
  const errors: string[] = [];

  if (!hasEbook && !hasAudiobook && input.requireFile !== false) errors.push(NO_FILES_ERROR);

  const ebookPrice = hasEbook ? positivePrice(input.ebookPrice) : null;
  if (hasEbook && ebookPrice === null) errors.push(EBOOK_PRICE_ERROR);

  const audiobookPrice = hasAudiobook ? positivePrice(input.audiobookPrice) : null;
  if (hasAudiobook && audiobookPrice === null) errors.push(AUDIOBOOK_PRICE_ERROR);

  return {
    hasEbook,
    hasAudiobook,
    ebookPrice,
    audiobookPrice,
    basePrice: hasEbook ? ebookPrice : audiobookPrice,
    errors,
  };
}
