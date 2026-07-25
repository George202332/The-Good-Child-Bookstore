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
