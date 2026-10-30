import { titleKey } from "@/lib/book-groups";

/**
 * Affiliate eligibility belongs to each EDITION (the eBook and Audiobook record, and the Print
 * record), not to the title: each edition has its own Affiliate Eligible switch in its own tab, so
 * an eBook-only or print-only book works on its own. An affiliate link points at a book, and works
 * for whichever editions of that title are eligible.
 */
export interface EditionLike {
  authorId: string;
  title: string;
  submissionMetadata?: unknown;
}

export type PurchasedFormat = "ebook" | "audiobook" | "paperback" | "hardcover" | string;

export function isPrintFormat(format: PurchasedFormat): boolean {
  return format === "paperback" || format === "hardcover";
}

/** Is the edition that sells this format switched on for affiliates? Print editions read their own switch
 * (affiliateEligiblePrint, which older saves also wrote as affiliateEnabled); eBook and audiobook read affiliateEnabled. */
export function editionAffiliateEligible(book: EditionLike, format: PurchasedFormat): boolean {
  const meta = (book.submissionMetadata ?? null) as { affiliateEnabled?: unknown; affiliateEligiblePrint?: unknown } | null;
  if (!meta) return false;
  if (isPrintFormat(format)) {
    if (typeof meta.affiliateEligiblePrint === "boolean") return meta.affiliateEligiblePrint;
    return meta.affiliateEnabled === true;
  }
  return meta.affiliateEnabled === true;
}

/** Two records are editions of the same title when they have the same author and the same title. */
export function sameTitle(a: Pick<EditionLike, "authorId" | "title">, b: Pick<EditionLike, "authorId" | "title">): boolean {
  return a.authorId === b.authorId && titleKey(a.title) === titleKey(b.title);
}

/** Does a sale of `purchased` (in this format) count as an affiliate sale for a link that points at `linked`?
 * It must be the linked book itself or another edition of the same title, AND that edition must be eligible. */
export function isAffiliateSaleFor(
  linked: (Pick<EditionLike, "authorId" | "title"> & { id: string }) | null,
  purchased: EditionLike & { id: string },
  format: PurchasedFormat,
): boolean {
  if (!linked) return false;
  const related = linked.id === purchased.id || sameTitle(linked, purchased);
  return related && editionAffiliateEligible(purchased, format);
}
