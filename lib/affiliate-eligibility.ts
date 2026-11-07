import { titleKey } from "@/lib/book-groups";

/**
 * Every published book is available to affiliates, in every format. An affiliate link points at a book and
 * earns on any edition of that title that is bought through it.
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

/** Every published book, in every format, is available to affiliates. This used to be a per-edition switch; old stored values
 * (affiliateEnabled, affiliateEligiblePrint) are ignored and left untouched. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function editionAffiliateEligible(_book: EditionLike, _format: PurchasedFormat): boolean {
  return true;
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
