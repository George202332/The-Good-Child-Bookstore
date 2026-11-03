import type { Book } from "@/lib/data/catalog";

/**
 * "Featured Books" on a product page: always six books (when the shop has that many), never the book being viewed.
 *
 * Until the first real rating arrives anywhere on the site, every published book counts as featured: the newest books, six at a
 * time, rotating through the whole shelf.
 *
 * From the moment the first real rating exists, the section switches by itself (there is no setting) to books of the SAME category
 * as the viewed book, best first. "Best" is a weighted score, not the plain average, so one lucky 5-star rating cannot beat a
 * book with a hundred 4.8s:
 *
 *     score = (n * R + m * C) / (n + m)
 *
 * R is the book's average rating, n its number of ratings, C the average rating of every real rating on the site, and m (PRIOR_WEIGHT)
 * how many ratings it takes before a book's own rating counts as much as the site average. With no ratings a book scores exactly C.
 * There is no star threshold and no minimum number of reviews; the ratings that exist at that moment are used.
 * Rated books come first, unrated ones after them (newest first). If the category has fewer than six books, the rest is filled with
 * other published books in the same order, so the section is never short.
 */
export const PRIOR_WEIGHT = 5;
export const FEATURED_COUNT = 6;

const ratingsOf = (b: Book) => (b.ratingCount && b.ratingCount > 0 ? b.ratingCount : 0);
const averageOf = (b: Book) => (ratingsOf(b) > 0 ? parseFloat(b.rating) || 0 : 0);
const newestFirst = (a: Book, b: Book) => (a.pubDate < b.pubDate ? 1 : a.pubDate > b.pubDate ? -1 : a.id.localeCompare(b.id));

/** The average of every real rating on the site (each rating counts once), or 0 when there are none. */
export function siteAverageRating(books: Book[]): number {
  let n = 0, sum = 0;
  for (const b of books) { n += ratingsOf(b); sum += ratingsOf(b) * averageOf(b); }
  return n > 0 ? sum / n : 0;
}

/** The weighted score of one book. */
export function weightedScore(b: Book, siteAverage: number, m = PRIOR_WEIGHT): number {
  const n = ratingsOf(b);
  return (n * averageOf(b) + m * siteAverage) / (n + m);
}

function rank(list: Book[], siteAverage: number): Book[] {
  const rated = list.filter((b) => ratingsOf(b) > 0).sort((a, b) => weightedScore(b, siteAverage) - weightedScore(a, siteAverage) || ratingsOf(b) - ratingsOf(a) || newestFirst(a, b));
  const unrated = list.filter((b) => ratingsOf(b) === 0).sort(newestFirst);
  return [...rated, ...unrated];
}

export interface FeaturedResult { books: Book[]; mode: "all" | "ranked" }

export function pickFeaturedBooks(viewed: Book, all: Book[], now = Date.now(), rotateMs = 20 * 60 * 1000, count = FEATURED_COUNT): FeaturedResult {
  const pool = all.filter((b) => b.id !== viewed.id);
  const siteAverage = siteAverageRating(all);
  if (siteAverage === 0) {
    // All books count as featured. A window of `count` that wraps round the shelf, so it is never short of books.
    const sorted = [...pool].sort(newestFirst);
    if (sorted.length <= count) return { books: sorted, mode: "all" };
    const start = (Math.floor(now / rotateMs) * count) % sorted.length;
    return { books: Array.from({ length: count }, (_, i) => sorted[(start + i) % sorted.length]), mode: "all" };
  }
  const same = viewed.category && viewed.category !== "unknown" ? pool.filter((b) => b.category === viewed.category) : [];
  const sameIds = new Set(same.map((b) => b.id));
  const others = pool.filter((b) => !sameIds.has(b.id));
  return { books: [...rank(same, siteAverage), ...rank(others, siteAverage)].slice(0, count), mode: "ranked" };
}
