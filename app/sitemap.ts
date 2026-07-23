import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { BOOKS } from "@/lib/data/catalog";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thegoodchildbookstore.com";

/**
 * Converted from the brief's SEO requirement to auto-generate
 * sitemap.xml. Static routes are always included; books and blog posts
 * are read live from the database so newly published/approved content
 * shows up automatically without a manual re-deploy.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/shop`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/blog`, changeFrequency: "daily", priority: 0.7 },
    { url: `${SITE_URL}/login`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/signup/reader`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/signup/author`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/signup/affiliate`, changeFrequency: "monthly", priority: 0.3 },
  ];

  let bookRoutes: MetadataRoute.Sitemap = [];
  let blogRoutes: MetadataRoute.Sitemap = [];

  try {
    const books = await prisma.book.findMany({
      where: { status: "PUBLISHED" },
      select: { id: true, updatedAt: true },
    });
    if (Array.isArray(books)) {
      bookRoutes = books.map((b: { id: string; updatedAt: Date }) => ({
        url: `${SITE_URL}/book/${b.id}`,
        lastModified: b.updatedAt,
        changeFrequency: "weekly",
        priority: 0.6,
      }));
    }
  } catch {
    // Fall back to the catalog fixture so the sitemap is never empty of
    // book URLs even if the database is unreachable.
    bookRoutes = BOOKS.map((b) => ({ url: `${SITE_URL}/book/${b.id}`, changeFrequency: "weekly", priority: 0.6 }));
  }

  try {
    const posts = await prisma.blog.findMany({
      where: { status: "PUBLISHED" },
      select: { slug: true, updatedAt: true },
    });
    if (Array.isArray(posts)) {
      blogRoutes = posts.map((p: { slug: string; updatedAt: Date }) => ({
        url: `${SITE_URL}/blog/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "monthly",
        priority: 0.5,
      }));
    }
  } catch {
    // No blog posts to fall back to statically — an empty list is fine.
  }

  return [...staticRoutes, ...bookRoutes, ...blogRoutes];
}
