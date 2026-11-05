import type { Book } from "@/lib/data/catalog";

/**
 * The book page only shows a handful of "featured" and "people also searched for" books. Instead of sending the browser every
 * book in the store, send the ones those two rows can possibly pick: books sharing this book's category, series or subcategory
 * (capped), plus a few of the newest as filler. Order is kept, so the rows are identical to what the full list produced.
 */
export function relatedCandidates(book: Book, all: readonly Book[], cap = 150, filler = 12): Book[] {
  const out: Book[] = [];
  const seen = new Set<string>();
  const add = (x: Book) => { if (!seen.has(x.id) && x.id !== book.id) { seen.add(x.id); out.push(x); } };
  let related = 0;
  for (const x of all) {
    const same = (!!book.series && x.series === book.series) || (!!book.subcategory && x.subcategory === book.subcategory) || (book.category !== "unknown" && x.category === book.category);
    if (same && related < cap) { add(x); related++; }
  }
  let extra = 0;
  for (const x of all) { if (extra >= filler) break; if (!seen.has(x.id) && x.id !== book.id) { add(x); extra++; } }
  return out;
}
