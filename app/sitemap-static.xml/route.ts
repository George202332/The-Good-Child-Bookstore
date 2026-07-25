import { NextResponse } from "next/server";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { buildUrlsetXml, XML_HEADERS } from "@/lib/seo/xml-helpers";

export const dynamic = "force-dynamic";

/** Every non-book, non-blog, non-author marketing/utility page. */
export async function GET() {
  const siteUrl = getPublicSiteUrl();
  const entries = [
    { loc: `${siteUrl}/`, changefreq: "daily", priority: 1 },
    { loc: `${siteUrl}/shop`, changefreq: "daily", priority: 0.9 },
    { loc: `${siteUrl}/blog`, changefreq: "daily", priority: 0.7 },
    { loc: `${siteUrl}/authors`, changefreq: "monthly", priority: 0.6 },
    { loc: `${siteUrl}/affiliate`, changefreq: "monthly", priority: 0.6 },
    { loc: `${siteUrl}/about`, changefreq: "monthly", priority: 0.4 },
    { loc: `${siteUrl}/contact`, changefreq: "monthly", priority: 0.4 },
    { loc: `${siteUrl}/faq`, changefreq: "monthly", priority: 0.4 },
    { loc: `${siteUrl}/subscription`, changefreq: "monthly", priority: 0.5 },
    { loc: `${siteUrl}/privacy`, changefreq: "yearly", priority: 0.2 },
    { loc: `${siteUrl}/terms`, changefreq: "yearly", priority: 0.2 },
    { loc: `${siteUrl}/returns`, changefreq: "yearly", priority: 0.2 },
    { loc: `${siteUrl}/login`, changefreq: "monthly", priority: 0.3 },
    { loc: `${siteUrl}/signup/reader`, changefreq: "monthly", priority: 0.3 },
    { loc: `${siteUrl}/signup/author`, changefreq: "monthly", priority: 0.3 },
    { loc: `${siteUrl}/signup/affiliate`, changefreq: "monthly", priority: 0.3 },
  ];
  return new NextResponse(buildUrlsetXml(entries), { headers: XML_HEADERS });
}
