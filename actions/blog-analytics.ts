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
 * its own to report here. */
export async function getBlogAnalytics(): Promise<BlogAnalytics> {
  const session = await auth();
  if (!session?.user) return EMPTY;

  const blogs = await prisma.blog.findMany({
    where: { authorId: session.user.id },
    include: { reads: true, comments: true },
  });
  if (blogs.length === 0) return EMPTY;

  const typed = blogs as { title: string; status: string; reads: { country: string | null; createdAt: Date }[]; comments: unknown[] }[];
  const publishedPosts = typed.filter((b) => b.status === "PUBLISHED").length;
  const allReads = typed.flatMap((b) => b.reads);
  const totalReads = allReads.length;
  const totalComments = typed.reduce((s, b) => s + b.comments.length, 0);

  const countryCounts = new Map<string, number>();
  for (const r of allReads) {
    const country = r.country || "Unknown";
    countryCounts.set(country, (countryCounts.get(country) ?? 0) + 1);
  }
  const regionBreakdown = Array.from(countryCounts.entries())
    .map(([country, reads]) => ({ country, reads }))
    .sort((a, b) => b.reads - a.reads)
    .slice(0, 8);

  const monthCounts = new Map<string, number>();
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthCounts.set(d.toLocaleDateString("en-US", { month: "short" }), 0);
  }
  for (const r of allReads) {
    const key = r.createdAt.toLocaleDateString("en-US", { month: "short" });
    if (monthCounts.has(key)) monthCounts.set(key, (monthCounts.get(key) ?? 0) + 1);
  }
  const monthlyReads = Array.from(monthCounts.entries()).map(([month, reads]) => ({ month, reads }));

  const topPosts = [...typed]
    .sort((a, b) => b.reads.length - a.reads.length)
    .slice(0, 8)
    .map((b) => ({ title: b.title, reads: b.reads.length, comments: b.comments.length }));

  return { totalReads, totalComments, publishedPosts, monthlyReads, regionBreakdown, topPosts };
}
