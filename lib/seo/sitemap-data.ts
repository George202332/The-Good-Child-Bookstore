import { prisma } from "@/lib/prisma";
import { getRealPublishedBooks } from "@/lib/data/real-books-adapter";
import { bookSlug } from "@/lib/data/catalog";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { allTopics, bookMatchesTopic, topicPath } from "@/lib/seo/topics";
import { listBlogTopics } from "@/lib/blog/related-server";
import { isThinBook } from "@/lib/seo/book-meta";
import type { SitemapUrlEntry } from "@/lib/seo/xml-helpers";

export { SITEMAP_CHUNK, chunk } from "@/lib/seo/sitemap-data-pure";

/**
 * One address per BOOK (the editions of a title are one book), only published books that are on sale in the store, leaving out
 * pages that ask not to be indexed (nothing to say and no cover). Last-changed dates come from the book's own record.
 */
export async function bookSitemapEntries(): Promise<SitemapUrlEntry[]> {
  const site = getPublicSiteUrl();
  const books = await getRealPublishedBooks();
  const rows = await prisma.book.findMany({ where: { status: "PUBLISHED" }, select: { id: true, updatedAt: true } });
  const updated = new Map(rows.map((r) => [r.id, r.updatedAt]));
  return books
    .filter((b) => !isThinBook({ title: b.title, author: b.author, blurb: b.blurb, hasCover: !!b.coverImage }))
    .map((b) => ({
      loc: `${site}/${bookSlug(b)}`,
      lastmod: (updated.get(b.id) ?? new Date()).toISOString(),
      changefreq: "weekly",
      priority: 0.7,
    }));
}

/** Book topic pages that have at least one book, plus blog topic pages. */
export async function topicSitemapEntries(): Promise<SitemapUrlEntry[]> {
  const site = getPublicSiteUrl();
  const entries: SitemapUrlEntry[] = [];
  try {
    const books = await getRealPublishedBooks();
    for (const t of allTopics()) {
      if (books.some((b) => bookMatchesTopic(b, t))) entries.push({ loc: `${site}${topicPath(t)}`, changefreq: "weekly", priority: t.kind === "category" || t.kind === "genre" ? 0.7 : 0.5 });
    }
  } catch { /* book topics are skipped when the database is unreachable */ }
  for (const t of await listBlogTopics()) entries.push({ loc: `${site}/blog/topic/${t.slug}`, changefreq: "weekly", priority: 0.5 });
  return entries;
}
