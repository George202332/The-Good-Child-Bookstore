import { prisma } from "@/lib/prisma";

/**
 * Website analytics report built ONLY from the visit counts this site recorded itself (AnalyticsEvent rows written by
 * /api/analytics/event, live site, accepted-analytics visitors only). Nothing is estimated or filled in: with no data,
 * every list is empty and the page says so. Money figures are the real totals of confirmed-paid orders.
 */

import { parseMonth, type WebAnalyticsReport } from "./report-format";
export { monthChoices, parseMonth, reportToCsv, type WebAnalyticsReport } from "./report-format";

type Row<T> = T & { n: bigint | number };
const num = (v: bigint | number | null | undefined) => Number(v ?? 0);

export async function buildWebAnalyticsReport(monthParam: string | null | undefined, opts: { includeMoney: boolean }): Promise<WebAnalyticsReport> {
  const { key, start, end, label } = parseMonth(monthParam);

  const [counts, pages, sources, books, convRows, revenueRow] = await Promise.all([
    prisma.$queryRaw<Row<{ type: string }>[]>`SELECT "type", COUNT(*) AS n FROM "AnalyticsEvent" WHERE "createdAt" >= ${start} AND "createdAt" < ${end} AND "type" IN ('page_view','book_view','add_to_cart','checkout_started','purchase','blog_to_book') GROUP BY "type"`,
    prisma.$queryRaw<Row<{ path: string }>[]>`SELECT "metadata"->>'path' AS path, COUNT(*) AS n FROM "AnalyticsEvent" WHERE "type" = 'page_view' AND "createdAt" >= ${start} AND "createdAt" < ${end} AND "metadata"->>'path' IS NOT NULL GROUP BY 1 ORDER BY n DESC LIMIT 200`,
    prisma.$queryRaw<Row<{ source: string }>[]>`SELECT "metadata"->>'source' AS source, COUNT(*) AS n FROM "AnalyticsEvent" WHERE "type" = 'page_view' AND "createdAt" >= ${start} AND "createdAt" < ${end} AND "metadata"->>'source' IS NOT NULL GROUP BY 1 ORDER BY n DESC`,
    prisma.$queryRaw<Row<{ bookId: string }>[]>`SELECT "metadata"->>'bookId' AS "bookId", COUNT(*) AS n FROM "AnalyticsEvent" WHERE "type" = 'book_view' AND "createdAt" >= ${start} AND "createdAt" < ${end} AND "metadata"->>'bookId' IS NOT NULL GROUP BY 1 ORDER BY n DESC LIMIT 20`,
    prisma.$queryRaw<Row<{ slug: string; type: string; revenue: number | null }>[]>`SELECT "metadata"->>'blogSlug' AS slug, "type", COUNT(*) AS n, SUM(CASE WHEN "type" = 'purchase' THEN ("metadata"->>'total')::numeric ELSE 0 END)::float AS revenue FROM "AnalyticsEvent" WHERE "createdAt" >= ${start} AND "createdAt" < ${end} AND "metadata"->>'blogSlug' IS NOT NULL AND "type" IN ('blog_to_book','book_view','add_to_cart','checkout_started','purchase') GROUP BY 1, 2`,
    prisma.$queryRaw<{ revenue: number | null }[]>`SELECT SUM(("metadata"->>'total')::numeric)::float AS revenue FROM "AnalyticsEvent" WHERE "type" = 'purchase' AND "createdAt" >= ${start} AND "createdAt" < ${end}`,
  ]);

  const c = (t: string) => num(counts.find((r) => r.type === t)?.n);

  // Blog posts: views come from page views of /blog/<slug>.
  const blogViews = new Map<string, number>();
  for (const p of pages) {
    const m = /^\/blog\/([^/]+)$/.exec(p.path);
    if (m && m[1] !== "topic") blogViews.set(m[1], (blogViews.get(m[1]) ?? 0) + num(p.n));
  }
  const convSlugs = new Set(convRows.map((r) => r.slug));
  const slugs = [...new Set([...blogViews.keys(), ...convSlugs])];
  const posts = slugs.length ? await prisma.blog.findMany({ where: { slug: { in: slugs } }, select: { slug: true, title: true } }) : [];
  const titleOf = new Map(posts.map((p) => [p.slug, p.title]));
  const bookRows = books.length ? await prisma.book.findMany({ where: { id: { in: books.map((b) => b.bookId) } }, select: { id: true, title: true } }) : [];
  const bookTitle = new Map(bookRows.map((b) => [b.id, b.title]));

  const conv = [...convSlugs].map((slug) => {
    const g = (t: string) => convRows.find((r) => r.slug === slug && r.type === t);
    return {
      slug, title: titleOf.get(slug) ?? slug,
      clicksToBooks: num(g("blog_to_book")?.n), bookViews: num(g("book_view")?.n), addToCart: num(g("add_to_cart")?.n),
      checkouts: num(g("checkout_started")?.n), purchases: num(g("purchase")?.n),
      revenue: opts.includeMoney ? Number(g("purchase")?.revenue ?? 0) : null,
    };
  }).sort((a, b) => b.purchases - a.purchases || b.clicksToBooks - a.clicksToBooks);

  const totalEvents = counts.reduce((s, r) => s + num(r.n), 0);
  return {
    month: key, monthLabel: label, hasData: totalEvents > 0,
    totals: {
      pageViews: c("page_view"), visits: sources.reduce((s, r) => s + num(r.n), 0), bookViews: c("book_view"), addToCart: c("add_to_cart"),
      checkoutStarted: c("checkout_started"), purchases: c("purchase"), revenue: opts.includeMoney ? Number(revenueRow[0]?.revenue ?? 0) : null,
    },
    topPages: pages.slice(0, 15).map((p) => ({ path: p.path, views: num(p.n) })),
    topBlogPosts: [...blogViews.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([slug, views]) => ({ slug, title: titleOf.get(slug) ?? slug, views })),
    topBooks: books.slice(0, 10).map((b) => ({ bookId: b.bookId, title: bookTitle.get(b.bookId) ?? "(removed book)", views: num(b.n) })),
    sources: sources.map((s) => ({ source: s.source, visits: num(s.n) })),
    blogConversion: conv,
  };
}
