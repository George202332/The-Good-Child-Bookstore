import { notFound } from "next/navigation";
import { imageAtWidth } from "@/lib/image-url";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getPublicBlogComments } from "@/actions/blog-comments";
import { BlogCommentSection } from "@/components/BlogCommentSection";
import { BlogShareButtons } from "@/components/BlogShareButtons";
import { blogPostingJsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { storeBlogRead, looksLikeBot } from "@/lib/blog/record-read";
import { getRequestGeo } from "@/lib/geo";
import { headers } from "next/headers";
import { parseBlocks, tocOf, readTimeMinutes as postReadTime, plainText, firstParagraph, type Inline } from "@/lib/blog/content";
import { parseKeywords } from "@/lib/blog/keywords";
import { after } from "next/server";
import { BlogClickTracker } from "@/components/AnalyticsTrackers";
import { booksForPost, postsForPost, listBlogTopics } from "@/lib/blog/related-server";
import { pageMeta } from "@/lib/seo/page-meta";
import { clip, wordCount } from "@/lib/seo/text";

export const dynamic = "force-dynamic";

interface PublishedBlog {
  id: string;
  title: string;
  subtitle: string | null;
  content: string;
  coverImageUrl: string | null;
  imageAltText: string | null;
  authorFirstName: string | null;
  authorLastName: string | null;
  categories: string[];
  tags: string[];
  metaTitle: string | null;
  metaDescription: string | null;
  seoKeywords: string | null;
  canonicalUrl: string | null;
  featured: boolean;
  allowComments: boolean;
  status: string;
  publishAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  authorId: string;
  author: { name: string };
}

function bylineFor(p: { authorFirstName: string | null; authorLastName: string | null; author: { name: string } }): string {
  return (p.authorFirstName || p.authorLastName) ? `${p.authorFirstName ?? ""} ${p.authorLastName ?? ""}`.trim() : p.author.name;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = await prisma.blog.findUnique({
      where: { slug },
      select: { title: true, content: true, status: true, metaTitle: true, metaDescription: true, canonicalUrl: true, coverImageUrl: true },
    });
    if (!post || post.status !== "PUBLISHED") return { title: "Post not found | The Good Child Bookstore", robots: { index: false, follow: false } };
    const description = post.metaDescription?.trim() || clip(firstParagraph(post.content) || plainText(post.content), 155);
    const meta = pageMeta({ title: post.metaTitle?.trim() || post.title, description, path: `/blog/${slug}`, image: post.coverImageUrl, type: "article" });
    // A post republished elsewhere may name that original address as its canonical address.
    return post.canonicalUrl ? { ...meta, alternates: { canonical: post.canonicalUrl } } : meta;
  } catch {
    return { title: "The Good Child Bookstore Journal" };
  }
}

/**
 * Rebuilt to match the reference blog-detail design: a real
 * hero
 * cover image, an author row with real read-time and real comment
 * count, category/tag chips, a plain article body, a sidebar
 * (author card, real share buttons, real "More from the journal"
 * related posts), and the comments section (hidden entirely when the
 * writer turned off "Allow comments"). Left out, honestly: the
 * view-counter and star-rating widget the original had were
 * simulated/demo-only, not real persisted data — adding fake numbers
 * here would be worse than omitting them.
 */
export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = (await prisma.blog.findUnique({
    where: { slug },
    include: { author: true },
  })) as PublishedBlog | null;

  if (!post || post.status !== "PUBLISHED" || (post.publishAt && post.publishAt > new Date())) notFound();
  // Counted after the page is sent, so the reader never waits for the database write.
  const readGeo = await getRequestGeo();
  const isBot = looksLikeBot((await headers()).get("user-agent"));
  if (!isBot) after(() => storeBlogRead(post.id, { country: readGeo.country ?? null, region: readGeo.region ?? null }));
  const comments = post.allowComments ? await getPublicBlogComments(post.id) : [];
  const siteUrl = getPublicSiteUrl();
  const readTime = postReadTime(post.content);
  const byline = bylineFor(post);
  const authorInitial = (byline || "?").trim().slice(0, 1).toUpperCase();

  const kw = parseKeywords(post.seoKeywords);
  const relPost = { slug, title: post.title, content: post.content, tags: post.tags, categories: post.categories, seoKeywords: post.seoKeywords };
  // Related posts and related books come from the post's own topics and words; either list is simply left out when empty.
  const [related, relatedBookRows, topics] = await Promise.all([postsForPost(relPost, 3), booksForPost(relPost, 3), listBlogTopics()]);
  const topicSlugs = new Set(topics.map((t) => t.slug));
  const blocks = parseBlocks(post.content);
  const toc = tocOf(blocks);
  const updated = post.updatedAt.getTime() - (post.publishAt ?? post.createdAt).getTime() > 24 * 3600 * 1000;
  const updatedLabel = post.updatedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const renderInline = (parts: Inline[]) => parts.map((x, i) => (x.href ? (x.href.startsWith("/") ? <Link key={i} href={x.href}>{x.text}</Link> : <a key={i} href={x.href} rel="noopener noreferrer" target="_blank">{x.text}</a>) : x.bold ? <strong key={i}>{x.text}</strong> : <span key={i}>{x.text}</span>));
  const topicSlugOf = (t: string) => t.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  const jsonLd = blogPostingJsonLd({
    title: post.title,
    slug,
    excerpt: post.metaDescription?.trim() || clip(firstParagraph(post.content) || plainText(post.content), 200),
    imageUrl: post.coverImageUrl ?? undefined,
    keywords: [kw.focus, ...kw.related, ...post.tags].filter(Boolean),
    wordCount: wordCount(plainText(post.content)),
    authorName: byline,
    datePublished: (post.publishAt ?? post.createdAt).toISOString(),
    dateModified: post.updatedAt.toISOString(),
  });
  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Home", url: `${siteUrl}/` },
    { name: "The Journal", url: `${siteUrl}/blog` },
    { name: post.title, url: `${siteUrl}/blog/${slug}` },
  ]);

  const dateLabel = (post.publishAt ?? post.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <BlogClickTracker slug={slug}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />

      <div className="blog-detail-cover">
        {post.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- real uploaded blog cover, hero size
          <img src={imageAtWidth(post.coverImageUrl, 1280)} alt={post.imageAltText || post.title} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "var(--lavender)" }} />
        )}
        <div className="blog-detail-cover-scrim" />
        <div className="wrap blog-detail-cover-overlay">
          <Link href="/blog" className="see-all" style={{ marginBottom: 18, display: "inline-block", color: "rgba(255,255,255,0.95)" }}>← Back to the journal</Link>
          {post.categories[0] && <div><span className="blog-detail-cover-badge">{post.categories[0]}</span></div>}
          <h1>{post.title}</h1>
          {post.subtitle && <p className="subtitle">{post.subtitle}</p>}
          <div className="blog-author-row">
            <div className="blog-sidebar-author-avatar">{authorInitial}</div>
            <div>
              <div className="blog-author-name">{byline}</div>
              <div className="blog-author-sub"><time dateTime={(post.publishAt ?? post.createdAt).toISOString()}>{dateLabel}</time> · {readTime} min read{updated && <> · Updated <time dateTime={post.updatedAt.toISOString()}>{updatedLabel}</time></>}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="wrap" style={{ padding: "40px 0 0" }}>
        <div className="blog-detail-layout">
          <div className="blog-detail-main">
            {toc.length >= 3 && (
              <nav className="blog-toc" aria-label="Table of contents" style={{ border: "1px solid var(--line, #e5e0ee)", borderRadius: 12, padding: "14px 18px", margin: "0 0 24px" }}>
                <strong style={{ fontSize: 14 }}>In this post</strong>
                <ol style={{ margin: "8px 0 0", paddingLeft: 20, fontSize: 14, lineHeight: 1.7 }}>
                  {toc.map((t) => <li key={t.id} style={{ marginLeft: t.level === 3 ? 16 : 0 }}><a href={`#${t.id}`}>{t.text}</a></li>)}
                </ol>
              </nav>
            )}
            <article className="blog-article-body">
              {blocks.map((b, i) => {
                switch (b.type) {
                  case "h2": return <h2 key={i} id={b.id}>{b.text}</h2>;
                  case "h3": return <h3 key={i} id={b.id}>{b.text}</h3>;
                  case "ul": return <ul key={i}>{b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ul>;
                  case "ol": return <ol key={i}>{b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}</ol>;
                  case "quote": return <blockquote key={i}>{renderInline(b.inline)}</blockquote>;
                  // eslint-disable-next-line @next/next/no-img-element -- an image the author placed in the post
                  case "img": return <img key={i} src={b.src} alt={b.alt || post.imageAltText || post.title} loading="lazy" decoding="async" style={{ maxWidth: "100%", height: "auto" }} />;
                  default: return <p key={i} style={{ whiteSpace: "pre-wrap" }}>{renderInline(b.inline)}</p>;
                }
              })}
            </article>
            {relatedBookRows.length > 0 && (
              <section style={{ margin: "28px 0" }} aria-label="Books to read next">
                <h2 style={{ fontSize: 20 }}>Books to read next</h2>
                <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 10 }}>
                  {relatedBookRows.map((b) => (
                    <li key={b.id}><Link href={`/${b.slug}`} style={{ fontWeight: 600 }}>{b.title}</Link> <span style={{ color: "var(--ink-soft)", fontSize: 14 }}>by {b.author}</span></li>
                  ))}
                </ul>
              </section>
            )}
            <div className="blog-article-end-mark">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="var(--coral)"><circle cx="12" cy="12" r="5" /></svg>
            </div>
            {post.tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "20px 0" }}>
                {post.tags.map((t) => topicSlugs.has(topicSlugOf(t)) ? <Link key={t} href={`/blog/topic/${topicSlugOf(t)}`} className="status-pill status-draft">{t}</Link> : <span key={t} className="status-pill status-draft">{t}</span>)}
              </div>
            )}

            <div className="blog-article-footer">
              <Link href="/blog" className="btn btn-ghost btn-small">Back to the Journal</Link>
            </div>

            {post.allowComments && (
              <div className="blog-detail-card" style={{ marginTop: 20 }}>
                <BlogCommentSection blogId={post.id} initial={comments} />
              </div>
            )}
          </div>

          <aside className="blog-detail-sidebar">
            <div className="blog-sidebar-card">
              <div className="blog-sidebar-author">
                <div className="blog-sidebar-author-avatar">{authorInitial}</div>
                <div><div className="blog-author-name">{byline}</div></div>
              </div>
              <p style={{ fontSize: 13, color: "var(--ink-soft)", lineHeight: 1.6, margin: 0 }}>
                Writing for The Good Child Bookstore journal.
              </p>
            </div>
            <div className="blog-sidebar-card">
              <div className="blog-sidebar-label">Share this post</div>
              <BlogShareButtons />
            </div>
            {post.categories.length > 0 && (
              <div className="blog-sidebar-card">
                <div className="blog-sidebar-label">Categories</div>
                <div className="blog-cat-pills">
                  {post.categories.map((c) => <Link key={c} href={`/blog/topic/${topicSlugOf(c)}`} className="blog-cat-pill active">{c}</Link>)}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {related.length > 0 && (
        <section className="section" style={{ paddingBottom: 70 }}>
          <div className="wrap">
            <div className="section-head" style={{ marginBottom: 20 }}><div><h2 style={{ fontSize: 21 }}>More from the Journal</h2></div></div>
            <div className="blog-grid">
              {related.map((p) => (
                <div key={p.slug} className="blog-card-v2">
                  <Link href={`/blog/${p.slug}`}>
                    <div className="blog-cover" style={{ background: "var(--lavender)" }}>
                      {p.coverImageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element -- related-post thumbnail
                        <img src={imageAtWidth(p.coverImageUrl, 640)} alt={p.imageAltText || p.title} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }} />
                      )}
                    </div>
                  </Link>
                  <div className="blog-body">
                    <Link href={`/blog/${p.slug}`}><h3>{p.title}</h3></Link>
                    <p>{(p.shortSummary || "").slice(0, 160)}{(p.shortSummary || "").length > 160 ? "…" : ""}</p>
                    <div className="blog-meta">
                                            <span>{(p.publishAt ?? p.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                    </div>
                    <Link className="blog-read-more" href={`/blog/${p.slug}`}>Read more →</Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </BlogClickTracker>
  );
}
