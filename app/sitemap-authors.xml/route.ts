import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { buildUrlsetXml, XML_HEADERS, type SitemapUrlEntry } from "@/lib/seo/xml-helpers";

export const dynamic = "force-dynamic";

/** One URL per author with at least one published book — matches the
 * new public author profile pages (/authors/profile/[id], see
 * app/authors/profile/[id]/page.tsx) built for E-E-A-T. */
export async function GET() {
  const siteUrl = getPublicSiteUrl();
  let entries: SitemapUrlEntry[] = [];

  try {
    const authors = await prisma.authorProfile.findMany({
      where: { books: { some: { status: "PUBLISHED" } } },
      select: { id: true },
    });
    if (Array.isArray(authors)) {
      entries = authors.map((a: { id: string }) => ({
        loc: `${siteUrl}/authors/profile/${a.id}`,
        changefreq: "monthly",
        priority: 0.4,
      }));
    }
  } catch {
    // an empty sitemap is fine
  }

  return new NextResponse(buildUrlsetXml(entries), { headers: XML_HEADERS });
}
