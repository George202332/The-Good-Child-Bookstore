import type { Book } from "@/lib/data/catalog";

/** How many books each home page book section shows: 2 rows of 6. */
export const HOME_SECTION_SIZE = 12;

function uniqueById(books: readonly Book[]): Book[] {
  const seen = new Set<string>();
  const out: Book[] = [];
  for (const b of books) {
    if (seen.has(b.id)) continue;
    seen.add(b.id);
    out.push(b);
  }
  return out;
}

function byNewest(a: Book, b: Book): number {
  // pubDate is an ISO date for real books. Ties keep a stable order by id.
  if (a.pubDate !== b.pubDate) return a.pubDate < b.pubDate ? 1 : -1;
  const aAdded = a.addedAt ?? "";
  const bAdded = b.addedAt ?? "";
  if (aAdded !== bAdded) return aAdded < bAdded ? 1 : -1;
  return a.id < b.id ? 1 : -1;
}

/** The newest published books, newest first, never repeating a book. */
export function pickNewArrivals(published: readonly Book[], size = HOME_SECTION_SIZE): Book[] {
  return uniqueById([...published].sort(byNewest)).slice(0, size);
}

/**
 * Best sellers: books ranked by their number of CONFIRMED PAID sales (the caller
 * passes counts from paid orders only), then topped up with other published
 * books (best rated first, then newest) so the section stays full for as long as
 * enough published books exist. A book never appears twice.
 */
export function pickBestSellers(
  published: readonly Book[],
  paidSalesByBookId: ReadonlyMap<string, number>,
  size = HOME_SECTION_SIZE,
): Book[] {
  const books = uniqueById(published);
  const sold = books
    .filter((b) => (paidSalesByBookId.get(b.id) ?? 0) > 0)
    .sort((a, b) => (paidSalesByBookId.get(b.id)! - paidSalesByBookId.get(a.id)!) || byNewest(a, b));
  const soldIds = new Set(sold.map((b) => b.id));
  const rest = books
    .filter((b) => !soldIds.has(b.id))
    .sort((a, b) => (b.reviews - a.reviews) || (parseFloat(b.rating) - parseFloat(a.rating) || 0) || byNewest(a, b));
  return [...sold, ...rest].slice(0, size);
}
