import { squash, wordCount } from "@/lib/seo/text";

/**
 * The SEO score for ONE book, shown to its author in the publishing checklist with plain advice such as "Add a longer
 * description". Every item is something the author controls. The score never blocks publishing: it only helps.
 */
export interface BookSeoInput {
  title: string;
  subtitle?: string | null;
  descriptionText: string;     // the description with the formatting removed
  hasCover: boolean;
  coverAlt?: string | null;
  category?: string | null;
  subcategory?: string | null;
  genre?: string | null;
  ageGroup?: string | null;
}
export interface BookSeoCheck { id: string; ok: boolean | "partial"; label: string; advice: string; /** points this element is worth (all add up to 100) */ worth: number; /** points earned now */ earned: number; /** what this element is, in plain words */ what: string }
export interface BookSeoResult { score: number; level: "good" | "warn" | "bad"; checks: BookSeoCheck[] }

/** How many of the 100 points each element is worth. The weights add up to exactly 100. */
export const BOOK_SEO_WORTH: Record<string, number> = {
  "desc-length": 25, "desc-title": 10, "desc-opening": 15, cover: 15, classified: 15, subtitle: 5, "title-length": 15,
};
const BOOK_SEO_WHAT: Record<string, string> = {
  "desc-length": "How many words your description has (80 or more earns full points, 40 to 79 earns half).",
  "desc-title": "Whether the description mentions the book's title.",
  "desc-opening": "Whether the first sentence of the description is at least 40 characters long.",
  cover: "Whether a cover image is uploaded.",
  classified: "Whether category, theme, genre and age group are all chosen.",
  subtitle: "Whether the book has a subtitle (optional, but adds searchable words).",
  "title-length": "Whether the title is between 4 and 70 characters.",
};

export function bookSeoScore(i: BookSeoInput): BookSeoResult {
  const desc = squash(i.descriptionText);
  const words = wordCount(desc);
  const title = squash(i.title);
  const raw: Omit<BookSeoCheck, "worth" | "earned" | "what">[] = [
    { id: "desc-length", ok: words >= 80 ? true : words >= 40 ? "partial" : false, label: "Description length", advice: words >= 40 ? `Add a longer description: ${words} words now; 80 or more helps readers and search engines.` : "Add a longer description. A description under 40 words is treated as thin and the page may be left out of search." },
    { id: "desc-title", ok: !!title && desc.toLowerCase().includes(title.toLowerCase().split(":")[0].trim()), label: "Title named in the description", advice: "Mention the book's title in the first sentence of the description." },
    { id: "desc-opening", ok: squash(desc.split(/(?<=[.!?])\s/)[0] ?? "").length >= 40, label: "A strong first sentence", advice: "Start with one clear sentence (40 characters or more) saying what the book is about: it is what search results usually show." },
    { id: "cover", ok: i.hasCover, label: "Cover image", advice: "Upload a cover image: books without one look incomplete and are less likely to be shown." },
    { id: "classified", ok: !!i.category && !!i.subcategory && !!i.genre && !!i.ageGroup, label: "Category, theme, genre and age group", advice: "Choose a category, theme (subcategory), genre and age group: they place the book on its topic pages and build its search title." },
    { id: "subtitle", ok: !!squash(i.subtitle), label: "Subtitle", advice: "A short subtitle (optional) adds words people search for." },
    { id: "title-length", ok: title.length >= 4 && title.length <= 70, label: "Title length", advice: "Keep the title between 4 and 70 characters so it is not cut off in search results." },
  ];
  const checks: BookSeoCheck[] = raw.map((c) => {
    const worth = BOOK_SEO_WORTH[c.id] ?? 0;
    const earned = c.ok === true ? worth : c.ok === "partial" ? Math.round(worth / 2) : 0;
    return { ...c, worth, earned, what: BOOK_SEO_WHAT[c.id] ?? "" };
  });
  const score = Math.min(100, checks.reduce((n, c) => n + c.earned, 0));
  return { score, level: score >= 80 ? "good" : score >= 50 ? "warn" : "bad", checks };
}
