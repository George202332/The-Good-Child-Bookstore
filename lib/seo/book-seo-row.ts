import { bookSeoScore, type BookSeoResult } from "@/lib/seo/book-seo-score";

/**
 * The SEO score shown in an author's My Books list, worked out from the saved book with the SAME rules as the publishing screen
 * (lib/seo/book-seo-score.ts), so the two numbers always agree. While an edit is waiting (or saved as a draft) the score is the
 * edited draft's, because that is what the publishing screen shows the author; once the edit is approved the draft becomes the
 * live book and the list is in step with it automatically. Pure: no database, nothing is changed.
 */
export interface SeoRowResult { score: number; level: BookSeoResult["level"]; draft: boolean }

type Rec = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const stripHtml = (h: string): string => h.replace(/<\/(p|h2|h3|li)>/g, " ").replace(/<br\s*\/?>/g, " ").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

export function seoScoreForBook(book: Rec, genreNames: string[]): SeoRowResult {
  const pending = book.pendingRevisionData as { kind?: string; state?: string; projected?: { fields?: Rec; genreName?: string; subcategoryName?: string } } | null | undefined;
  const projected = pending?.kind === "full" && pending.projected?.fields ? pending.projected : null;
  const f: Rec = { ...book, ...(projected?.fields ?? {}) };
  const genre = projected?.genreName || genreNames[0] || "";
  const r = bookSeoScore({
    title: str(f.title),
    subtitle: str(f.subtitle),
    descriptionText: stripHtml(str(f.description)),
    hasCover: !!str(f.coverImageUrl),
    category: str(f.category),
    subcategory: projected?.subcategoryName || str(f.subcategory),
    genre,
    ageGroup: str(f.ageGroup),
  });
  return { score: r.score, level: r.level, draft: !!projected };
}
