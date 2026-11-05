import { NextResponse } from "next/server";
import { buildUrlsetXml, XML_HEADERS } from "@/lib/seo/xml-helpers";
import { bookSitemapEntries, chunk } from "@/lib/seo/sitemap-data";

export const dynamic = "force-dynamic";

/** Published books, one address per book. Split into files of 1,000 addresses: /sitemap-books.xml?page=2 and so on. */
export async function GET(request: Request) {
  const page = Math.max(1, Number(new URL(request.url).searchParams.get("page")) || 1);
  let entries: Awaited<ReturnType<typeof bookSitemapEntries>> = [];
  try { entries = await bookSitemapEntries(); } catch { /* an empty file is better than an error for crawlers */ }
  const parts = chunk(entries);
  return new NextResponse(buildUrlsetXml(parts[page - 1] ?? []), { headers: XML_HEADERS });
}
