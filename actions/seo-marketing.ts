"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authEither as auth } from "@/lib/auth-either";
import { canModerateContent } from "@/lib/roles";
import { getPublicSiteUrl } from "@/lib/seo/site-url";

/**
 * SEO & Marketing admin dashboard data — wires up two models that
 * existed in the schema from the start but had no UI at all: SeoEntry
 * (per-path title/description/OG image overrides) and AnalyticsEvent
 * (a generic event log, used here for indexable-content counts).
 */

export interface SeoOverview {
  publishedBooks: number;
  publishedBlogs: number;
  publishedAuthors: number;
  booksWithoutIsbn: number;
  booksWithoutCover: number;
  blogsWithoutExcerpt: number;
  totalOutboundAffiliateClicks: number;
}

export async function getSeoOverview(): Promise<SeoOverview> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !canModerateContent(role)) {
    return { publishedBooks: 0, publishedBlogs: 0, publishedAuthors: 0, booksWithoutIsbn: 0, booksWithoutCover: 0, blogsWithoutExcerpt: 0, totalOutboundAffiliateClicks: 0 };
  }

  try {
    const [publishedBooks, publishedBlogs, publishedAuthors, booksWithoutIsbn, booksWithoutCover, blogsWithoutExcerpt, clicks] = await Promise.all([
      prisma.book.count({ where: { status: "PUBLISHED" } }),
      prisma.blog.count({ where: { status: "PUBLISHED" } }),
      prisma.authorProfile.count({ where: { books: { some: { status: "PUBLISHED" } } } }),
      prisma.book.count({ where: { status: "PUBLISHED", isbn: null } }),
      prisma.book.count({ where: { status: "PUBLISHED", coverImageUrl: null } }),
      prisma.blog.count({ where: { status: "PUBLISHED", content: "" } }),
      prisma.affiliateClick.count(),
    ]);
    return { publishedBooks, publishedBlogs, publishedAuthors, booksWithoutIsbn, booksWithoutCover, blogsWithoutExcerpt, totalOutboundAffiliateClicks: clicks };
  } catch {
    return { publishedBooks: 0, publishedBlogs: 0, publishedAuthors: 0, booksWithoutIsbn: 0, booksWithoutCover: 0, blogsWithoutExcerpt: 0, totalOutboundAffiliateClicks: 0 };
  }
}

export interface SeoEntryRow {
  id: string;
  path: string;
  title: string | null;
  description: string | null;
  ogImageUrl: string | null;
}

export async function listSeoEntries(): Promise<SeoEntryRow[]> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return [];
  return prisma.seoEntry.findMany({ orderBy: { path: "asc" } });
}

export async function upsertSeoEntry(input: { path: string; title: string; description: string; ogImageUrl: string }): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Only Admins can edit SEO overrides." };

  const path = input.path.trim();
  if (!path.startsWith("/")) return { ok: false, error: "Path must start with /, e.g. /shop" };

  await prisma.seoEntry.upsert({
    where: { path },
    update: { title: input.title.trim() || null, description: input.description.trim() || null, ogImageUrl: input.ogImageUrl.trim() || null },
    create: { path, title: input.title.trim() || null, description: input.description.trim() || null, ogImageUrl: input.ogImageUrl.trim() || null },
  });
  revalidatePath("/admin/seo-marketing");
  return { ok: true };
}

export async function deleteSeoEntry(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Only Admins can delete SEO overrides." };
  await prisma.seoEntry.delete({ where: { id } });
  revalidatePath("/admin/seo-marketing");
  return { ok: true };
}

export interface IndexNowLogRow {
  id: string;
  url: string;
  statusCode: number | null;
  ok: boolean;
  createdAt: Date;
}

/** Manually fires an IndexNow submission for a specific URL — for a
 * page that was updated outside the normal publish flow, or just to
 * confirm the integration is actually working. */
export async function triggerIndexNow(url: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !canModerateContent(role)) return { ok: false, error: "Not authorized." };
  if (!url.trim()) return { ok: false, error: "Enter a URL first." };

  const { submitUrlToIndexNow } = await import("@/lib/indexnow");
  const result = await submitUrlToIndexNow(url.trim());
  revalidatePath("/admin/seo-marketing");
  return result.ok ? { ok: true } : { ok: false, error: `Submission failed${result.statusCode ? ` (status ${result.statusCode})` : ""}.` };
}

export async function listIndexNowLog(): Promise<IndexNowLogRow[]> {
  const session = await auth();
  if (!session?.user?.role || !canModerateContent(session.user.role)) return [];
  return prisma.indexNowSubmission.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
}

export interface RedirectRow {
  id: string;
  fromPath: string;
  toPath: string;
  statusCode: number;
  createdAt: Date;
}

export async function listRedirects(): Promise<RedirectRow[]> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return [];
  return prisma.redirect.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createRedirect(input: { fromPath: string; toPath: string; statusCode: number }): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Only Admins can manage redirects." };

  const fromPath = input.fromPath.trim();
  const toPath = input.toPath.trim();
  if (!fromPath.startsWith("/")) return { ok: false, error: "The old path must start with /, e.g. /book/old-slug" };
  if (!toPath.startsWith("/") && !toPath.startsWith("http")) return { ok: false, error: "The new path must start with / or be a full URL." };
  if (fromPath === toPath) return { ok: false, error: "The old and new paths can't be the same." };

  await prisma.redirect.upsert({
    where: { fromPath },
    update: { toPath, statusCode: input.statusCode },
    create: { fromPath, toPath, statusCode: input.statusCode },
  });
  revalidatePath("/admin/seo-marketing");
  return { ok: true };
}

export async function deleteRedirect(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Only Admins can manage redirects." };
  await prisma.redirect.delete({ where: { id } });
  revalidatePath("/admin/seo-marketing");
  return { ok: true };
}

export interface IndexingRow {
  url: string;
  type: "Book" | "Blog post" | "Author profile" | "Static page";
  title: string;
  status: "SUBMITTED" | "FAILED" | "NOT_YET_SUBMITTED";
  lastSubmittedAt: Date | null;
}

/**
 * A real indexing report — every book, blog post, author profile, and
 * static page currently eligible for indexing (the same set the
 * sitemaps expose), cross-referenced against the actual IndexNow
 * submission log (see lib/indexnow.ts) to show real status.
 *
 * One honest limit worth being direct about: "submitted successfully"
 * here means IndexNow's own API accepted the ping — it is not the same
 * as Google or Bing confirming they actually crawled and indexed the
 * page. That confirmation only exists inside Google Search Console and
 * Bing Webmaster Tools themselves, which requires verified site
 * ownership and OAuth access this app doesn't have configured. This
 * report shows the most complete, honest picture available without
 * that: what's eligible for indexing, and what was actually submitted.
 */
export async function getIndexingReport(): Promise<IndexingRow[]> {
  const session = await auth();
  if (!session?.user?.role || !canModerateContent(session.user.role)) return [];

  try {
    const siteUrl = getPublicSiteUrl();
    const [books, blogs, authors, submissions] = await Promise.all([
      prisma.book.findMany({ where: { status: "PUBLISHED" }, select: { id: true, title: true, slug: true } }),
      prisma.blog.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, title: true } }),
      prisma.authorProfile.findMany({
        where: { books: { some: { status: "PUBLISHED" } } },
        select: { id: true, user: { select: { name: true } } },
      }),
      prisma.indexNowSubmission.findMany({ orderBy: { createdAt: "desc" } }),
    ]);

    const STATIC_PAGES = ["/", "/bookshelf", "/blog", "/authors", "/affiliate", "/about", "/contact", "/faq"];

    const latestByUrl = new Map<string, { ok: boolean; createdAt: Date }>();
    for (const s of submissions) {
      if (!latestByUrl.has(s.url)) latestByUrl.set(s.url, { ok: s.ok, createdAt: s.createdAt });
    }

    function statusFor(url: string): { status: IndexingRow["status"]; lastSubmittedAt: Date | null } {
      const match = latestByUrl.get(url);
      if (!match) return { status: "NOT_YET_SUBMITTED", lastSubmittedAt: null };
      return { status: match.ok ? "SUBMITTED" : "FAILED", lastSubmittedAt: match.createdAt };
    }

    const rows: IndexingRow[] = [];
    for (const b of books) {
      const url = `${siteUrl}/${b.slug}`;
      rows.push({ url, type: "Book", title: b.title, ...statusFor(url) });
    }
    for (const b of blogs) {
      const url = `${siteUrl}/blog/${b.slug}`;
      rows.push({ url, type: "Blog post", title: b.title, ...statusFor(url) });
    }
    for (const a of authors) {
      const url = `${siteUrl}/authors/profile/${a.id}`;
      rows.push({ url, type: "Author profile", title: a.user.name, ...statusFor(url) });
    }
    for (const path of STATIC_PAGES) {
      const url = `${siteUrl}${path}`;
      rows.push({ url, type: "Static page", title: path === "/" ? "Home" : path, ...statusFor(url) });
    }

    return rows.sort((a, b) => {
      if (a.status !== b.status) return a.status === "NOT_YET_SUBMITTED" ? 1 : -1;
      return (b.lastSubmittedAt?.getTime() ?? 0) - (a.lastSubmittedAt?.getTime() ?? 0);
    });
  } catch {
    return [];
  }
}

export interface SeoQualityIssue { kind: "book" | "post"; title: string; slug: string; problem: string }

/**
 * Quality flags for user-published content: books with a duplicate or near-empty description or no cover, and posts that are
 * thin, have no internal link, or share a focus keyword with another post. Read-only. Staff only.
 */
export async function listSeoQualityIssues(): Promise<SeoQualityIssue[]> {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !canModerateContent(role)) return [];
  const issues: SeoQualityIssue[] = [];
  try {
    const { squash, wordCount } = await import("@/lib/seo/text");
    const { plainText, linkCounts } = await import("@/lib/blog/content");
    const { parseKeywords, normalizeKeyword } = await import("@/lib/blog/keywords");
    const books = await prisma.book.findMany({ where: { status: "PUBLISHED" }, select: { title: true, slug: true, description: true, coverImageUrl: true }, take: 3000 });
    const seen = new Map<string, string[]>();
    for (const b of books) {
      const d = squash(b.description).toLowerCase();
      if (d.length >= 20) seen.set(d, [...(seen.get(d) ?? []), b.title]);
    }
    for (const b of books) {
      const d = squash(b.description);
      if (d.length < 40) issues.push({ kind: "book", title: b.title, slug: b.slug, problem: "Description is empty or almost empty (under 40 characters)" });
      else if ((seen.get(d.toLowerCase())?.length ?? 0) > 1) issues.push({ kind: "book", title: b.title, slug: b.slug, problem: "Description is identical to another book's" });
      if (!b.coverImageUrl) issues.push({ kind: "book", title: b.title, slug: b.slug, problem: "No cover image" });
    }
    const posts = await prisma.blog.findMany({ where: { status: "PUBLISHED" }, select: { title: true, slug: true, content: true, seoKeywords: true }, take: 3000 });
    const focusCount = new Map<string, number>();
    for (const p of posts) { const f = normalizeKeyword(parseKeywords(p.seoKeywords).focus); if (f) focusCount.set(f, (focusCount.get(f) ?? 0) + 1); }
    for (const p of posts) {
      const words = wordCount(plainText(p.content));
      if (words < 300) issues.push({ kind: "post", title: p.title, slug: p.slug, problem: `Thin post (${words} words; under 300)` });
      if (linkCounts(p.content, new URL(getPublicSiteUrl()).host).internal === 0) issues.push({ kind: "post", title: p.title, slug: p.slug, problem: "No link to a book, author or category" });
      const f = normalizeKeyword(parseKeywords(p.seoKeywords).focus);
      if (f && (focusCount.get(f) ?? 0) > 1) issues.push({ kind: "post", title: p.title, slug: p.slug, problem: `Focus keyword “${f}” is also used by another post` });
    }
  } catch {
    // an empty list is shown if the database cannot be read
  }
  return issues;
}
