import { normalizeKeyword, parseKeywords } from "@/lib/blog/keywords";
import { slugify } from "@/lib/seo/text";

/**
 * Links posts and books both ways so a post can lead to a sale. Pure scoring; the database reads are in related-server.ts.
 * A book scores for each of the post's keywords, tags and categories found in the book's title, category, subcategory, genre or
 * author, and for the book's title or author being named in the post. Nothing is shown at score zero.
 */
export interface RelPost { slug: string; title: string; content?: string; tags: string[]; categories: string[]; seoKeywords?: string | null }
export interface RelBook { id: string; title: string; slug: string; author: string; series?: string | null; subcategory?: string | null; genre?: string | null; coverImage?: string | null }

export function postTerms(p: Pick<RelPost, "tags" | "categories" | "seoKeywords">): string[] {
  const k = parseKeywords(p.seoKeywords);
  const all = [k.focus, ...k.related, ...p.tags, ...p.categories].map(normalizeKeyword).filter((t) => t.length >= 3);
  return [...new Set(all)];
}

export function scoreBookForPost(post: RelPost, book: RelBook): number {
  const hay = normalizeKeyword([book.title, book.series, book.subcategory, book.genre, book.author].filter(Boolean).join(" "));
  let score = 0;
  for (const t of postTerms(post)) if (hay.includes(t)) score += 2;
  const text = normalizeKeyword(`${post.title} ${post.content ?? ""}`);
  if (book.title.length >= 4 && text.includes(normalizeKeyword(book.title))) score += 5;
  if (book.author.length >= 4 && text.includes(normalizeKeyword(book.author))) score += 2;
  return score;
}

export function relatedBooksForPost(post: RelPost, books: RelBook[], limit = 3): RelBook[] {
  return books
    .map((b) => ({ b, s: scoreBookForPost(post, b) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.b.title.localeCompare(b.b.title))
    .slice(0, limit)
    .map((x) => x.b);
}

/** Posts that share topics with this post (tags, categories, keywords). The newest come first when scores tie. */
export function relatedPosts<T extends RelPost & { at?: Date | string }>(post: RelPost, others: T[], limit = 3): T[] {
  const mine = new Set(postTerms(post));
  return others
    .filter((o) => o.slug !== post.slug)
    .map((o) => ({ o, s: postTerms(o).filter((t) => mine.has(t)).length }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || new Date(b.o.at ?? 0).getTime() - new Date(a.o.at ?? 0).getTime())
    .slice(0, limit)
    .map((x) => x.o);
}

export function topicSlug(name: string): string { return slugify(name); }
