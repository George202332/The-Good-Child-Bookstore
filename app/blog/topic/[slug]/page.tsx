import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { LIVE_POST, listBlogTopics } from "@/lib/blog/related-server";
import { pageMeta } from "@/lib/seo/page-meta";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/json-ld";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { clip } from "@/lib/seo/text";
import { plainText, readTimeMinutes } from "@/lib/blog/content";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 15;

/** A crawlable blog topic page (one per category or tag in use), grouping related posts around one subject. */
async function load(slug: string, pageRaw: string | undefined) {
  const topics = await listBlogTopics();
  const topic = topics.find((t) => t.slug === slug);
  if (!topic) return null;
  const where = { ...LIVE_POST, AND: [{ OR: [{ categories: { has: topic.name } }, { tags: { has: topic.name } }] }] };
  const total = await prisma.blog.count({ where });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageRaw) || 1), pages);
  const posts = await prisma.blog.findMany({
    where,
    select: { slug: true, title: true, shortSummary: true, content: true, publishAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  return { topic, topics, total, pages, page, posts };
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { page } = await searchParams;
  const data = await load(slug, page).catch(() => null);
  if (!data) return { title: "Not found | The Good Child Bookstore", robots: { index: false, follow: false } };
  const p = data.page;
  return pageMeta({
    title: p > 1 ? `${data.topic.name}: Journal Posts, page ${p}` : `${data.topic.name}: Journal Posts`,
    description: `Read ${data.total} journal ${data.total === 1 ? "post" : "posts"} about ${data.topic.name.toLowerCase()} from The Good Child Bookstore, with the children's books they lead to.`,
    path: `/blog/topic/${slug}${p > 1 ? `?page=${p}` : ""}`,
  });
}

export default async function BlogTopicPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> }) {
  const { slug } = await params;
  const { page: pageRaw } = await searchParams;
  const data = await load(slug, pageRaw).catch(() => null);
  if (!data) notFound();
  const { topic, topics, pages, page, posts } = data;
  const site = getPublicSiteUrl();
  const others = topics.filter((t) => t.slug !== topic.slug).slice(0, 16);
  return (
    <div className="wrap" style={{ padding: "40px 0 60px", maxWidth: 860 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd([{ name: "Home", url: `${site}/` }, { name: "The Journal", url: `${site}/blog` }, { name: topic.name, url: `${site}/blog/topic/${slug}` }])) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd(`${topic.name}: Journal Posts`, posts.map((p) => ({ name: p.title, url: `${site}/blog/${p.slug}` })))) }} />
      <div className="breadcrumb"><Link href="/">Home</Link> › <Link href="/blog">The Journal</Link> › {topic.name}</div>
      <h1 style={{ margin: "12px 0 6px" }}>{topic.name}</h1>
      <p style={{ color: "var(--ink-soft)" }}>{data.total} {data.total === 1 ? "post" : "posts"} on this subject.</p>
      <ul style={{ listStyle: "none", padding: 0, margin: "24px 0", display: "grid", gap: 22 }}>
        {posts.map((p) => (
          <li key={p.slug}>
            <h2 style={{ fontSize: 20, margin: "0 0 4px" }}><Link href={`/blog/${p.slug}`}>{p.title}</Link></h2>
            <p style={{ margin: "0 0 4px", color: "var(--ink-soft)" }}>{clip(p.shortSummary || plainText(p.content), 170)}</p>
            <span style={{ fontSize: 13, color: "var(--ink-faint)" }}>{(p.publishAt ?? p.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · {readTimeMinutes(p.content)} min read</span>
          </li>
        ))}
      </ul>
      {pages > 1 && (
        <nav aria-label="Pages" style={{ display: "flex", gap: 14, fontSize: 14, margin: "20px 0" }}>
          {page > 1 && <Link href={page === 2 ? `/blog/topic/${slug}` : `/blog/topic/${slug}?page=${page - 1}`} rel="prev">← Previous</Link>}
          <span>Page {page} of {pages}</span>
          {page < pages && <Link href={`/blog/topic/${slug}?page=${page + 1}`} rel="next">Next →</Link>}
        </nav>
      )}
      {others.length > 0 && (
        <section aria-label="Other topics"><h2 style={{ fontSize: 18 }}>More topics</h2>
          <p style={{ fontSize: 14, lineHeight: 1.9 }}>{others.map((t, i) => <span key={t.slug}>{i > 0 && " · "}<Link href={`/blog/topic/${t.slug}`}>{t.name}</Link></span>)}</p>
        </section>
      )}
    </div>
  );
}
