import { prisma } from "@/lib/prisma";
import { bookAuthorDisplayName } from "@/lib/book-author-name";
import { normalizeKeyword } from "@/lib/blog/keywords";
import { postTerms, relatedBooksForPost, relatedPosts, topicSlug, type RelBook, type RelPost } from "@/lib/blog/related";

/** Live posts only (published and not scheduled for later). */
export const LIVE_POST = { status: "PUBLISHED" as const, OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] };

/** Books that go with a post, found by the post's own words. Never throws. */
export async function booksForPost(post: RelPost, limit = 3): Promise<RelBook[]> {
  try {
    const terms = postTerms(post).slice(0, 8);
    const titleWords = post.title.split(/\s+/).filter((w) => w.length > 4).slice(0, 4);
    const ors = [...terms, ...titleWords].flatMap((t) => [
      { title: { contains: t, mode: "insensitive" as const } },
      { category: { contains: t, mode: "insensitive" as const } },
      { subcategory: { contains: t, mode: "insensitive" as const } },
    ]);
    const rows = await prisma.book.findMany({
      where: { status: "PUBLISHED", ...(ors.length ? { OR: ors } : {}) },
      select: { id: true, title: true, slug: true, category: true, subcategory: true, coverImageUrl: true, submissionMetadata: true, author: { select: { penName: true, user: { select: { name: true } } } } },
      take: 40,
    });
    const books: RelBook[] = rows.map((r) => ({
      id: r.id, title: r.title, slug: r.slug, series: r.category, subcategory: r.subcategory, coverImage: r.coverImageUrl,
      author: bookAuthorDisplayName({ submissionMetadata: r.submissionMetadata, author: r.author as never }),
    }));
    return relatedBooksForPost(post, books, limit);
  } catch {
    return [];
  }
}

/** Posts that relate to a post (same topics), newest first on ties. Never throws. */
export async function postsForPost(post: RelPost, limit = 3) {
  try {
    const rows = await prisma.blog.findMany({
      where: { ...LIVE_POST, slug: { not: post.slug } },
      select: { slug: true, title: true, tags: true, categories: true, seoKeywords: true, shortSummary: true, coverImageUrl: true, imageAltText: true, publishAt: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 60,
    });
    const items = rows.map((r) => ({ ...r, at: r.publishAt ?? r.createdAt }));
    return relatedPosts(post, items, limit);
  } catch {
    return [];
  }
}

/** Posts that mention or match a book: the other direction, shown on the book page. */
export async function postsForBook(book: { title: string; author: string; series?: string | null; subcategory?: string | null }, limit = 3) {
  try {
    const needles = [book.title, book.series, book.subcategory].filter((x): x is string => !!x && x.length >= 4);
    const rows = await prisma.blog.findMany({
      where: {
        ...LIVE_POST,
        AND: [{ OR: [
          { title: { contains: book.title, mode: "insensitive" } },
          { content: { contains: book.title, mode: "insensitive" } },
          ...needles.slice(1).flatMap((n) => [{ tags: { has: n } }, { categories: { has: n } }, { seoKeywords: { contains: n, mode: "insensitive" as const } }]),
        ] }],
      },
      select: { slug: true, title: true, shortSummary: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows;
  } catch {
    return [];
  }
}

export interface BlogTopic { slug: string; name: string; kind: "category" | "tag"; count: number }

/** Every category and tag used by a live post, as crawlable topic pages. Categories are the main subjects; tags are finer. */
export async function listBlogTopics(): Promise<BlogTopic[]> {
  try {
    const rows = await prisma.blog.findMany({ where: LIVE_POST, select: { categories: true, tags: true }, take: 2000 });
    const map = new Map<string, BlogTopic>();
    const bump = (name: string, kind: "category" | "tag") => {
      const n = name.trim();
      if (n.length < 2) return;
      const slug = topicSlug(n);
      if (!slug) return;
      const cur = map.get(slug);
      if (cur) { cur.count++; if (kind === "category") cur.kind = "category"; } else map.set(slug, { slug, name: n, kind, count: 1 });
    };
    for (const r of rows) { r.categories.forEach((c) => bump(c, "category")); r.tags.forEach((t) => bump(t, "tag")); }
    return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export { normalizeKeyword };
