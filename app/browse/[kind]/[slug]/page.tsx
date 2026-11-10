import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookCard } from "@/components/BookCard";
import { getRealPublishedBooks } from "@/lib/data/real-books-adapter";
import { getVisitorCountries } from "@/lib/visitor-country";
import { bookSlug } from "@/lib/data/catalog";
import { allTopics, bookMatchesTopic, findTopic, topicDescription, topicPath } from "@/lib/seo/topics";
import { pageMeta } from "@/lib/seo/page-meta";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/json-ld";
import { getPublicSiteUrl } from "@/lib/seo/site-url";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

/** A crawlable topic page: every category, subcategory, genre and age group has its own address, title and list of book links. */
async function load(kind: string, slug: string, pageRaw: string | undefined) {
  const topic = findTopic(kind, slug);
  if (!topic) return null;
  const all = await getRealPublishedBooks(await getVisitorCountries());
  const books = all.filter((b) => bookMatchesTopic(b, topic));
  const pages = Math.max(1, Math.ceil(books.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, Number(pageRaw) || 1), pages);
  return { topic, books, page, pages, slice: books.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) };
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ kind: string; slug: string }>; searchParams: Promise<{ page?: string }> }): Promise<Metadata> {
  const { kind, slug } = await params;
  const { page } = await searchParams;
  const data = await load(kind, slug, page);
  if (!data) return { title: "Not found | The Good Child Bookstore", robots: { index: false, follow: false } };
  const { topic, books, page: p } = data;
  return pageMeta({
    title: p > 1 ? `${topic.heading}, page ${p}` : topic.heading,
    description: topicDescription(topic, books.length),
    path: p > 1 ? `${topicPath(topic)}?page=${p}` : topicPath(topic),
    // A topic with no books yet has nothing to index.
    noindex: books.length === 0,
  });
}

export default async function BrowseTopicPage({ params, searchParams }: { params: Promise<{ kind: string; slug: string }>; searchParams: Promise<{ page?: string }> }) {
  const { kind, slug } = await params;
  const { page: pageRaw } = await searchParams;
  const data = await load(kind, slug, pageRaw);
  if (!data) notFound();
  const { topic, books, page, pages, slice } = data;
  const site = getPublicSiteUrl();
  const siblings = allTopics().filter((t) => t.kind === topic.kind && t.slug !== topic.slug && (topic.kind !== "subcategory" || t.parent?.slug === topic.parent?.slug));
  const children = topic.kind === "category" ? allTopics().filter((t) => t.kind === "subcategory" && t.parent?.slug === topic.slug) : [];
  const crumbs = [
    { name: "Home", url: `${site}/` },
    { name: "Bookshelf", url: `${site}/bookshelf` },
    ...(topic.parent ? [{ name: topic.parent.name, url: `${site}${topicPath(topic.parent)}` }] : []),
    { name: topic.name, url: `${site}${topicPath(topic)}` },
  ];
  return (
    <div className="wrap" style={{ padding: "40px 0 60px" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(crumbs)) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd(topic.heading, slice.map((b) => ({ name: b.title, url: `${site}/${bookSlug(b)}` })))) }} />
      <div className="breadcrumb">
        <Link href="/">Home</Link> › <Link href="/bookshelf">Bookshelf</Link> ›{" "}
        {topic.parent && (<><Link href={topicPath(topic.parent)}>{topic.parent.name}</Link> › </>)}
        {topic.name}
      </div>
      <h1 style={{ margin: "12px 0 8px" }}>{topic.heading}</h1>
      <p style={{ color: "var(--ink-soft)", maxWidth: 720 }}>{topicDescription(topic, books.length)}</p>

      {children.length > 0 && (
        <p style={{ fontSize: 14, margin: "14px 0" }}>
          <strong>Browse by theme: </strong>
          {children.map((c, i) => <span key={c.slug}>{i > 0 && " · "}<Link href={topicPath(c)}>{c.name}</Link></span>)}
        </p>
      )}

      {slice.length === 0 ? (
        <p style={{ margin: "30px 0", color: "var(--ink-faint)" }}>No books here yet. <Link href="/bookshelf">Browse the whole bookshelf</Link>.</p>
      ) : (
        <div className="book-grid-6" style={{ marginTop: 20 }}>
          {slice.map((b, i) => <BookCard key={b.id} book={b} priority={i < 6} />)}
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pages" style={{ display: "flex", gap: 14, margin: "28px 0", fontSize: 14 }}>
          {page > 1 && <Link href={page === 2 ? topicPath(topic) : `${topicPath(topic)}?page=${page - 1}`} rel="prev">← Previous</Link>}
          <span>Page {page} of {pages}</span>
          {page < pages && <Link href={`${topicPath(topic)}?page=${page + 1}`} rel="next">Next →</Link>}
        </nav>
      )}

      {siblings.length > 0 && (
        <section style={{ marginTop: 36 }} aria-label="Related topics">
          <h2 style={{ fontSize: 18 }}>{topic.kind === "age" ? "Other age groups" : topic.kind === "genre" ? "Other genres" : topic.kind === "category" ? "Other categories" : "Other themes in this category"}</h2>
          <p style={{ fontSize: 14, lineHeight: 1.9 }}>
            {siblings.map((t, i) => <span key={t.slug}>{i > 0 && " · "}<Link href={topicPath(t)}>{t.name}</Link></span>)}
          </p>
        </section>
      )}
    </div>
  );
}
