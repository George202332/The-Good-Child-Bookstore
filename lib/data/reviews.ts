import type { Book } from "@/lib/data/catalog";

/** Ported from REVIEW_POOL / fixedReviewsForBook() / baseStarCounts() / reviewStats()
 * (the-good-child-bookstore_54_1.html:2202-2251). Deterministic per-book demo
 * reviews, plus real reader-submitted reviews (stored in localStorage — see
 * hooks/useCustomReviews.ts) blended into the same stats. */

export interface Review {
  name: string;
  text: string;
  rating: number;
  date: string;
}

const REVIEW_POOL: { name: string; text: string }[] = [
  { name: "Harper L.", text: "My daughter asks for this one by name every single night. The pictures hold her attention all the way to the last page." },
  { name: "Sam T.", text: "Beautifully illustrated and just the right length for bedtime; never feels rushed, never drags on." },
  { name: "Priya N.", text: "The pacing is perfect for reading aloud. My son has started \"reading\" it back to me from memory." },
  { name: "Marcus O.", text: "A new favorite in our house. The art alone is worth the price, and the story holds up after a dozen rereads." },
  { name: "Elena V.", text: "Well-made and durable pages (survived toddler handling just fine), and the story still lands with our older one too." },
  { name: "Jonah K.", text: "Sweet story with a gentle lesson, no heavy-handed moralizing. Exactly what we look for on this shelf." },
  { name: "Aisha R.", text: "We read this every single week and it still gets a laugh from both kids, even the one who claims to be too old for picture books." },
  { name: "Diego F.", text: "Gorgeous color palette and a story that rewards a slower read: worth taking your time with the pictures." },
];

export function fixedReviewsForBook(b: Book): Review[] {
  const idx = parseInt(b.id.replace("b", ""), 10) || 0;
  const ratings = [5, 5, 4, 5, 4];
  const dates = ["2 weeks ago", "1 month ago", "3 months ago", "4 months ago", "5 months ago"];
  return [0, 1, 2, 3, 4].map((k) => {
    const pick = REVIEW_POOL[(idx + k) % REVIEW_POOL.length];
    return { ...pick, rating: ratings[k], date: dates[k] };
  });
}

export function baseStarCounts(b: Book): number[] {
  const r = parseFloat(b.rating);
  const pct = r >= 4.5 ? [72, 20, 5, 2, 1] : [55, 28, 10, 4, 3];
  const total = b.reviews;
  const counts = pct.map((p) => Math.round((total * p) / 100));
  const diff = total - counts.reduce((a, c) => a + c, 0);
  counts[0] += diff;
  return counts; // [5-star, 4-star, 3-star, 2-star, 1-star]
}

export interface ReviewStats {
  counts: number[];
  total: number;
  avg: string;
  pct: number[];
}

export function reviewStats(b: Book, custom: Review[]): ReviewStats {
  const counts = baseStarCounts(b).slice();
  custom.forEach((r) => {
    counts[5 - r.rating] = (counts[5 - r.rating] || 0) + 1;
  });
  const total = counts.reduce((a, c) => a + c, 0);
  const sumStars = counts.reduce((a, c, i) => a + c * (5 - i), 0);
  const avg = total ? sumStars / total : 0;
  const pct = counts.map((c) => (total ? Math.round((c / total) * 100) : 0));
  return { counts, total, avg: avg.toFixed(1), pct };
}

export function reviewsForBook(b: Book, custom: Review[]): Review[] {
  return [...custom.slice().reverse(), ...fixedReviewsForBook(b)];
}
