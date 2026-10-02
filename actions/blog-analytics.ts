import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export interface BlogAnalytics {
  totalReads: number;
  totalComments: number;
  publishedPosts: number;
  monthlyReads: { month: string; reads: number }[];
  regionBreakdown: { country: string; reads: number }[];
  topPosts: { title: string; reads: number; comments: number }[];
}

const EMPTY: BlogAnalytics = { totalReads: 0, totalComments: 0, publishedPosts: 0, monthlyReads: [], regionBreakdown: [], topPosts: [] };

/** Pure-numbers analytics for this account's own blog posts — reads,
 * comments, and the real geotagged regions those reads came from (see
 * lib/geo.ts). Never shows currency; blogging has no direct revenue of
 * its own to report here.
 *
 * Rewritten to stop pulling every individual BlogRead/BlogComment row
 * for this account into memory (`include: { reads: true, comments:
 * true }` on every one of the writer's posts) just to count and bucket
 * them in JS. For a post (or an account) with a real amount of
 * traffic — exactly the case this page exists to report on — that was
 * an unbounded fetch that grows without limit as reads accumulate,
 * and was the likely cause of this page failing to load at all once
 * there was enough data: a slow, memory-heavy query that can exceed
 * the serverless function's time/memory budget outright (a genuine
 * crash a try/catch around the query can't help with, since the
 * function is killed before it has a chance to reject normally).
 * Every number below now comes from the database doing the counting
 * (groupBy/count/_count), with only the last 6 months of raw rows
 * (country + createdAt, nothing else) pulled into memory for the
 * month-bucketing that has no SQL-level equivalent here. */
export async function getBlogAnalytics(): Promise<BlogAnalytics> {
  const session = await auth();
  if (!session?.user) return EMPTY;
  const authorId = session.user.id;

  const publishedPosts = await prisma.blog.count({ where: { authorId, status: "PUBLISHED" } });
  if (publishedPosts === 0) {
    // Still worth checking for reads/comments on drafts that were
    // later unpublished, but if there's never been a single post at
    // all, skip straight to the empty state.
    const anyPost = await prisma.blog.count({ where: { authorId } });
    if (anyPost === 0) return EMPTY;
  }

  const now = new Date();
  const sixMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [totalReads, totalComments, regionGroups, recentReads, topPostsRaw] = await Promise.all([
    prisma.blogRead.count({ where: { blog: { authorId } } }),
    prisma.blogComment.count({ where: { blog: { authorId } } }),
    // Region breakdown, counted in the database — only the top 8
    // countries are ever shown, but every group still has to be
    // counted, so this is naturally bounded by the number of distinct
    // countries (at most a couple hundred), not the number of reads.
    prisma.blogRead.groupBy({ by: ["country"], where: { blog: { authorId } }, _count: { _all: true } }),
    // Only what month-bucketing actually needs (createdAt), only for
    // the 6-month window the chart shows, not every read ever recorded.
    prisma.blogRead.findMany({
      where: { blog: { authorId }, createdAt: { gte: sixMonthsAgoStart } },
      select: { createdAt: true },
    }),
    // Top posts by reads — the database does the counting (_count),
    // and only the top 8 rows are ever used, so this fetches 8 small
    // rows regardless of how many reads/comments those posts have.
    prisma.blog.findMany({
      where: { authorId },
      select: { title: true, _count: { select: { reads: true, comments: true } } },
      orderBy: { reads: { _count: "desc" } },
      take: 8,
    }),
  ]);

  const regionBreakdown = (regionGroups as { country: string | null; _count: { _all: number } }[])
    .map((g) => ({ country: g.country || "Unknown", reads: g._count._all }))
    .sort((a, b) => b.reads - a.reads)
    .slice(0, 8);

  const monthCounts = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthCounts.set(d.toLocaleDateString("en-US", { month: "short" }), 0);
  }
  for (const r of recentReads) {
    const key = r.createdAt.toLocaleDateString("en-US", { month: "short" });
    if (monthCounts.has(key)) monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const monthlyReads = Array.from(monthCounts.entries()).map(([month, reads]) => ({ month, reads }));

  const topPosts = (topPostsRaw as { title: string; _count: { reads: number; comments: number } }[]).map((b) => ({
    title: b.title,
    reads: b._count.reads,
    comments: b._count.comments,
  }));

  return { totalReads, totalComments, publishedPosts, monthlyReads, regionBreakdown, topPosts };
}
