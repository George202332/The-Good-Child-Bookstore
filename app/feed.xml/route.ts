import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPublicSiteUrl } from "@/lib/seo/site-url";

export const dynamic = "force-dynamic";

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** RSS 2.0 feed combining new blog posts and new book releases, for
 * instant content syndication (feed readers, aggregators, some search
 * engines pick up new content faster via RSS than a full re-crawl). */
export async function GET() {
  const siteUrl = getPublicSiteUrl();

  const [posts, books] = await Promise.all([
    prisma.blog.findMany({
      where: { status: "PUBLISHED" },
      include: { author: { include: { user: true } } },
      orderBy: { publishAt: "desc" },
      take: 20,
    }),
    prisma.book.findMany({
      where: { status: "PUBLISHED" },
      include: { author: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  type FeedItem = { title: string; link: string; description: string; pubDate: Date; author: string };
  const items: FeedItem[] = [
    ...posts.map((p: { title: string; slug: string; content: string; publishAt: Date | null; createdAt: Date; author: { user: { name: string } } }) => ({
      title: p.title,
      link: `${siteUrl}/blog/${p.slug}`,
      description: p.content.slice(0, 300),
      pubDate: p.publishAt ?? p.createdAt,
      author: p.author.user.name,
    })),
    ...books.map((b: { title: string; id: string; description: string | null; createdAt: Date; author: { user: { name: string } } }) => ({
      title: `New book: ${b.title}`,
      link: `${siteUrl}/book/${b.id}`,
      description: b.description ?? "",
      pubDate: b.createdAt,
      author: b.author.user.name,
    })),
  ].sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());

  const itemsXml = items
    .map(
      (item) => `  <item>
    <title>${xmlEscape(item.title)}</title>
    <link>${xmlEscape(item.link)}</link>
    <guid>${xmlEscape(item.link)}</guid>
    <description>${xmlEscape(item.description)}</description>
    <author>${xmlEscape(item.author)}</author>
    <pubDate>${item.pubDate.toUTCString()}</pubDate>
  </item>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>The Good Child Bookstore — New Books &amp; Journal Posts</title>
  <link>${siteUrl}</link>
  <description>New children's books and journal posts from The Good Child Bookstore.</description>
${itemsXml}
</channel>
</rss>`;

  return new NextResponse(xml, { headers: { "Content-Type": "application/rss+xml" } });
}
