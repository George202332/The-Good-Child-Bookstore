import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getPublicBlogComments } from "@/actions/blog-comments";
import { BlogCommentSection } from "@/components/BlogCommentSection";
import { BlogReadingProgress } from "@/components/BlogReadingProgress";
import { BlogShareButtons } from "@/components/BlogShareButtons";
import { blogPostingJsonLd, breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { getPublicSiteUrl } from "@/lib/seo/site-url";

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

interface RelatedBlog {
  slug: string;
  title: string;
  content: string;
  shortSummary: string | null;
  coverImageUrl: string | null;
  imageAltText: string | null;
  authorFirstName: string | null;
  authorLastName: string | null;
  publishAt: Date | null;
  createdAt: Date;
  author: { name: string };
}

function readTimeMinutes(content: string): number {
  const words = content.split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.round(words / 200));
}

function bylineFor(p: { authorFirstName: string | null; authorLastName: string | null; author: { name: string } }): string {
  return (p.authorFirstName || p.authorLastName) ? `${p.authorFirstName ?? ""} ${p.authorLastName ?? ""}`.trim() : p.author.name;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const siteUrl = getPublicSiteUrl();
  try {
    const post = await prisma.blog.findUnique({
      where: { slug },
      select: { title: true, content: true, status: true, metaTitle: true, metaDescription: true, canonicalUrl: true, coverImageUrl: true },
    });
    if (!post || post.status !== "PUBLISHED") return { title: "Post not found | The Good Child Bookstore" };
    const title = `${post.metaTitle || post.title} | The Good Child Bookstore Journal`;
    const description = post.metaDescription || post.content.slice(0, 155);
    return {
      title,
      description,
      alternates: { canonical: post.canonicalUrl || `${siteUrl}/blog/${slug}` },
      openGraph: { title, description, type: "article", ...(post.coverImageUrl ? { images: [post.coverImageUrl] } : {}) },
      twitter: { card: "summary_large_image", title, description, ...(post.coverImageUrl ? { images: [post.coverImageUrl] } : {}) },
    };
  } catch {
    return { title: "The Good Child Bookstore Journal" };
  }
}

/**
 * Rebuilt to match the reference blog-detail design: a real
 * scroll-tracked reading-progress bar + sticky mini-header, a hero
 * cover image, an author row with real read-time and real comment
 * count, category/tag chips, a drop-cap article body, a sidebar
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
  const comments = post.allowComments ? await getPublicBlogComments(post.id) : [];
  const siteUrl = getPublicSiteUrl();
  const readTime = readTimeMinutes(post.content);
  const byline = bylineFor(post);
  const authorInitial = (byline || "?").trim().slice(0, 1).toUpperCase();

  let related: RelatedBlog[] = [];
  try {
    const result = await prisma.blog.findMany({
      where: { status: "PUBLISHED", slug: { not: slug } },
      include: { author: true },
      orderBy: { publishAt: "desc" },
      take: 3,
    });
    if (Array.isArray(result)) related = result as RelatedBlog[];
  } catch {
    // Related posts are a nice-to-have — an empty list is fine.
  }

  const jsonLd = blogPostingJsonLd({
    title: post.title,
    slug,
    excerpt: post.content.slice(0, 200),
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
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <BlogReadingProgress title={post.title} />

      <div className="blog-detail-cover">
        {post.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- real uploaded blog cover, hero size
          <img src={post.coverImageUrl} alt={post.imageAltText || post.title} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "var(--lavender)" }} />
        )}
        <div className="blog-detail-cover-scrim" />
        {post.categories[0] && <span className="blog-detail-cover-badge">{post.categories[0]}</span>}
      </div>

      <div className="wrap" style={{ padding: "30px 0 0" }}>
        <Link href="/blog" className="see-all" style={{ marginBottom: 18, display: "inline-block" }}>← Back to the journal</Link>
        <h1 style={{ fontSize: 38, lineHeight: 1.15, margin: "0 0 10px", maxWidth: 820 }}>{post.title}</h1>
        {post.subtitle && <p style={{ fontSize: 17, color: "var(--ink-soft)", marginBottom: 6, maxWidth: 720 }}>{post.subtitle}</p>}

        <div className="blog-detail-layout">
          <div className="blog-detail-main">
            <div className="blog-author-row">
              <div className="blog-sidebar-author-avatar">{authorInitial}</div>
              <div>
                <div className="blog-author-name">{byline}</div>
                <div className="blog-author-sub">{dateLabel} · {readTime} min read</div>
              </div>
            </div>

            <article className="blog-article-body blog-article-dropcap">
              {post.content.split(/\n\s*\n/).filter((p) => p.trim()).map((para, i) => (
                <p key={i} style={{ whiteSpace: "pre-wrap" }}>{para.trim()}</p>
              ))}
            </article>

            {post.tags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "20px 0" }}>
                {post.tags.map((t) => <span key={t} className="status-pill status-draft">{t}</span>)}
              </div>
            )}

            <div className="blog-article-footer">
              {post.allowComments && <div className="blog-article-footer-meta">{comments.length} comment{comments.length === 1 ? "" : "s"}</div>}
              <Link href="/blog" className="btn btn-ghost btn-small">Back to the journal</Link>
            </div>

            {post.allowComments && (
              <div className="blog-detail-card" style={{ marginTop: 20 }}>
                <h2 style={{ fontSize: 18, marginBottom: 14 }}>Comments</h2>
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
                  {post.categories.map((c) => <span key={c} className="blog-cat-pill active">{c}</span>)}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {related.length > 0 && (
        <section className="section" style={{ paddingBottom: 70 }}>
          <div className="wrap">
            <div className="section-head" style={{ marginBottom: 20 }}><div><h2 style={{ fontSize: 21 }}>More from the journal</h2></div></div>
            <div className="blog-grid">
              {related.map((p) => (
                <div key={p.slug} className="blog-card-v2">
                  <Link href={`/blog/${p.slug}`}>
                    <div className="blog-cover" style={{ background: "var(--lavender)" }}>
                      {p.coverImageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element -- related-post thumbnail
                        <img src={p.coverImageUrl} alt={p.imageAltText || p.title} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }} />
                      )}
                    </div>
                  </Link>
                  <div className="blog-body">
                    <Link href={`/blog/${p.slug}`}><h3>{p.title}</h3></Link>
                    <p>{(p.shortSummary || p.content).slice(0, 160)}{(p.shortSummary || p.content).length > 160 ? "…" : ""}</p>
                    <div className="blog-meta">
                      <span>by {bylineFor(p)}</span>
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
    </div>
  );
}
