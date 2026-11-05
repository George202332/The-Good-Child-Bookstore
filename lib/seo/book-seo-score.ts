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
export interface BookSeoCheck { id: string; ok: boolean | "partial"; label: string; advice: string }
export interface BookSeoResult { score: number; level: "good" | "warn" | "bad"; checks: BookSeoCheck[] }

export function bookSeoScore(i: BookSeoInput): BookSeoResult {
  const desc = squash(i.descriptionText);
  const words = wordCount(desc);
  const title = squash(i.title);
  const checks: BookSeoCheck[] = [
    { id: "desc-length", ok: words >= 80 ? true : words >= 40 ? "partial" : false, label: "Description length", advice: words >= 40 ? `Add a longer description: ${words} words now; 80 or more helps readers and search engines.` : "Add a longer description. A description under 40 words is treated as thin and the page may be left out of search." },
    { id: "desc-title", ok: !!title && desc.toLowerCase().includes(title.toLowerCase().split(":")[0].trim()), label: "Title named in the description", advice: "Mention the book's title in the first sentence of the description." },
    { id: "desc-opening", ok: squash(desc.split(/(?<=[.!?])\s/)[0] ?? "").length >= 40, label: "A strong first sentence", advice: "Start with one clear sentence (40 characters or more) saying what the book is about: it is what search results usually show." },
    { id: "cover", ok: i.hasCover, label: "Cover image", advice: "Upload a cover image: books without one look incomplete and are less likely to be shown." },
    { id: "classified", ok: !!i.category && !!i.subcategory && !!i.genre && !!i.ageGroup, label: "Category, theme, genre and age group", advice: "Choose a category, theme (subcategory), genre and age group: they place the book on its topic pages and build its search title." },
    { id: "subtitle", ok: !!squash(i.subtitle) ? true : "partial", label: "Subtitle", advice: "A short subtitle (optional) adds words people search for." },
    { id: "title-length", ok: title.length >= 4 && title.length <= 70, label: "Title length", advice: "Keep the title between 4 and 70 characters so it is not cut off in search results." },
  ];
  const points = checks.reduce((n, c) => n + (c.ok === true ? 1 : c.ok === "partial" ? 0.5 : 0), 0);
  const score = Math.round((points / checks.length) * 100);
  return { score, level: score >= 80 ? "good" : score >= 50 ? "warn" : "bad", checks };
}
