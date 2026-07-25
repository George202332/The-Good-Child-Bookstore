import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BOOKS } from "@/lib/data/catalog";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { buildUrlsetXml, XML_HEADERS, type SitemapUrlEntry } from "@/lib/seo/xml-helpers";

export const dynamic = "force-dynamic";

/** Real, published books first (live from the database — updates
 * immediately as new titles are approved), falling back to the demo
 * catalog if the database is unreachable. Split into its own sub-sitemap
 * so crawlers can prioritize re-crawling new/changed books without
 * wasting crawl budget on rarely-changing static pages. */
export async function GET() {
  const siteUrl = getPublicSiteUrl();
  let entries: SitemapUrlEntry[] = [];

  try {
    const books = await prisma.book.findMany({ where: { status: "PUBLISHED" }, select: { id: true, updatedAt: true } });
    if (Array.isArray(books) && books.length > 0) {
      entries = books.map((b: { id: string; updatedAt: Date }) => ({
        loc: `${siteUrl}/book/${b.id}`,
        lastmod: b.updatedAt.toISOString(),
        changefreq: "weekly",
        priority: 0.6,
      }));
    }
  } catch {
    // fall through to the demo catalog below
  }

  if (entries.length === 0) {
    entries = BOOKS.map((b) => ({ loc: `${siteUrl}/book/${b.id}`, changefreq: "weekly", priority: 0.6 }));
  }

  return new NextResponse(buildUrlsetXml(entries), { headers: XML_HEADERS });
}
