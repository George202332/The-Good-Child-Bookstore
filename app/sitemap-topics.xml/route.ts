import { NextResponse } from "next/server";
import { buildUrlsetXml, XML_HEADERS } from "@/lib/seo/xml-helpers";
import { topicSitemapEntries } from "@/lib/seo/sitemap-data";

export const dynamic = "force-dynamic";

/** Book topic pages (category, subcategory, genre, age group) and blog topic pages, only where they have content. */
export async function GET() {
  let entries: Awaited<ReturnType<typeof topicSitemapEntries>> = [];
  try { entries = await topicSitemapEntries(); } catch { /* empty file rather than an error */ }
  return new NextResponse(buildUrlsetXml(entries), { headers: XML_HEADERS });
}
