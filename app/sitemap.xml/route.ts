import { NextResponse } from "next/server";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { buildSitemapIndexXml, XML_HEADERS } from "@/lib/seo/xml-helpers";
import { bookSitemapEntries, chunk } from "@/lib/seo/sitemap-data";
import { isIndexableDeployment } from "@/lib/seo/indexing";

export const dynamic = "force-dynamic";

/**
 * sitemap.xml is an INDEX pointing at the sub-sitemaps: books (split into files of 1,000), blog posts, authors, topic pages and
 * static pages. Staging answers with an empty index so it never advertises addresses.
 */
export async function GET() {
  const siteUrl = getPublicSiteUrl();
  if (!isIndexableDeployment()) return new NextResponse(buildSitemapIndexXml([]), { headers: XML_HEADERS });
  let bookFiles = 1;
  try { bookFiles = chunk(await bookSitemapEntries()).length; } catch { /* one file */ }
  const books = Array.from({ length: bookFiles }, (_, i) => `${siteUrl}/sitemap-books.xml${bookFiles > 1 ? `?page=${i + 1}` : ""}`);
  const xml = buildSitemapIndexXml([
    ...books,
    `${siteUrl}/sitemap-blogs.xml`,
    `${siteUrl}/sitemap-authors.xml`,
    `${siteUrl}/sitemap-topics.xml`,
    `${siteUrl}/sitemap-static.xml`,
  ]);
  return new NextResponse(xml, { headers: XML_HEADERS });
}
