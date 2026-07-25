import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { buildUrlsetXml, XML_HEADERS, type SitemapUrlEntry } from "@/lib/seo/xml-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const siteUrl = getPublicSiteUrl();
  let entries: SitemapUrlEntry[] = [];

  try {
    const posts = await prisma.blog.findMany({ where: { status: "PUBLISHED" }, select: { slug: true, updatedAt: true } });
    if (Array.isArray(posts)) {
      entries = posts.map((p: { slug: string; updatedAt: Date }) => ({
        loc: `${siteUrl}/blog/${p.slug}`,
        lastmod: p.updatedAt.toISOString(),
        changefreq: "monthly",
        priority: 0.5,
      }));
    }
  } catch {
    // an empty sitemap is fine — no static fallback for blog posts
  }

  return new NextResponse(buildUrlsetXml(entries), { headers: XML_HEADERS });
}
