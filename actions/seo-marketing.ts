"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canModerateContent } from "@/lib/roles";

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
