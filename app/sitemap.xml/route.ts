import { NextResponse } from "next/server";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { buildSitemapIndexXml, XML_HEADERS } from "@/lib/seo/xml-helpers";

export const dynamic = "force-dynamic";

/**
 * The real sitemap.xml is now a sitemap INDEX (per the brief's "Dynamic
 * XML Sitemap... separates routes into sub-sitemaps") rather than one
 * flat file — pointing crawlers at sitemap-books.xml, sitemap-blogs.xml,
 * sitemap-authors.xml, and sitemap-static.xml, each maintained
 * independently so new books/posts show up without touching the others.
 */
export async function GET() {
  const siteUrl = getPublicSiteUrl();
  const xml = buildSitemapIndexXml([
    `${siteUrl}/sitemap-books.xml`,
    `${siteUrl}/sitemap-blogs.xml`,
    `${siteUrl}/sitemap-authors.xml`,
    `${siteUrl}/sitemap-static.xml`,
  ]);
  return new NextResponse(xml, { headers: XML_HEADERS });
}
