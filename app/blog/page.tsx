import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Motif } from "@/components/Motif";
import type { MotifKind } from "@/lib/data/catalog";
import { hashStr } from "@/lib/hash";
import { getPagesContent } from "@/actions/page-content";
import { BLOG_PAGE_SIZE, blogListUrl, pageWindow, parsePageParam, searchTerms, totalPagesFor } from "@/lib/blog-pagination";

export const dynamic = "force-dynamic";

const MOTIFS: MotifKind[] = ["owl", "leaf", "star", "moon", "heart", "tree"];

interface PublishedBlog {
  slug: string;
  title: string;
  subtitle: string | null;
  content: string;
  shortSummary: string | null;
  coverImageUrl: string | null;
  imageAltText: string | null;
  authorFirstName: string | null;
  authorLastName: string | null;
  categories: string[];
  featured: boolean;
  publishAt: Date | null;
  createdAt: Date;
  author: { name: string };
  _count: { comments: number };
}

/** Real reading time, the same way the original computed it: word count
 * over 200 words/minute, minimum 3 minutes. */
function readTimeMinutes(content: string): number {
  const words = content.split(/\s+/).filter(Boolean).length;
  return Math.max(3, Math.round(words / 200));
}

function bylineFor(p: { authorFirstName: string | null; authorLastName: string | null; author: { name: string } }): string {
  return (p.authorFirstName || p.authorLastName) ? `${p.authorFirstName ?? ""} ${p.authorLastName ?? ""}`.trim() : p.author.name;
}

/** Public blog listing — real published posts only (status PUBLISHED,
 * and only once their scheduled publish date has actually arrived),
 * styled to match the reference design's .blog-card-v2 layout: cover,
 * category, title, subtitle, excerpt, author/date, and a real read-time
 * + comment-count meta row. View counts from the original aren't shown
 * since this app doesn't track real view counts — a fake number would
 * be worse than leaving it out. */
export default async function BlogListPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; page?: string | string[] }> }) {
  const { blog } = await getPagesContent();
  const sp = await searchParams;
  const terms = searchTerms(sp.q);
  const query = terms.join(" ");
  const requestedPage = parsePageParam(sp.page);

  // Live posts only; when the header search box is used on this page,
  // every word typed must match the post's title or its author's name.
  const where = {
    status: "PUBLISHED" as const,
    AND: [
      { OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] },
      ...terms.map((t) => ({
        OR: [
          { title: { contains: t, mode: "insensitive" as const } },
          { authorFirstName: { contains: t, mode: "insensitive" as const } },
          { authorLastName: { contains: t, mode: "insensitive" as const } },
          { author: { name: { contains: t, mode: "insensitive" as const } } },
        ],
      })),
    ],
  };

  let posts: PublishedBlog[] = [];
  let totalPosts = 0;
  let page = requestedPage;
  try {
    totalPosts = await prisma.blog.count({ where });
    page = Math.min(requestedPage, totalPagesFor(totalPosts));
    const result = await prisma.blog.findMany({
      where,
      include: { author: true, _count: { select: { comments: true } } },
      orderBy: { publishAt: "desc" },
      skip: (page - 1) * BLOG_PAGE_SIZE,
      take: BLOG_PAGE_SIZE,
    });
    if (Array.isArray(result)) posts = result as PublishedBlog[];
  } catch {
    // Degrade to an empty list rather than a 500 if the database is
    // unreachable — this page should never be the reason a visitor sees
    // an error page.
  }

  return (
    <div className="wrap" style={{ paddingTop: 48, paddingBottom: 60 }}>
      <div className="section-head" style={{ marginBottom: 24 }}>
        <div>
          <h1>{blog.heading}</h1>
          {blog.bodyHtml ? (
            <div className="page-body-content" style={{ color: "var(--ink-soft)" }} dangerouslySetInnerHTML={{ __html: blog.bodyHtml }} />
          ) : (
            <p style={{ color: "var(--ink-soft)" }}>{blog.introText}</p>
          )}
        </div>
      </div>
      {query && (
        <p className="blog-search-note">
          {totalPosts === 0 ? "No blog posts match" : `${totalPosts} blog post${totalPosts === 1 ? "" : "s"} matching`} “{query}”.{" "}
          <Link href="/blog">Clear search</Link>
        </p>
      )}
      {posts.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>
          {query ? "Try a different title or author name." : "Nothing published yet — check back soon."}
        </div>
      ) : (
        <div className="blog-grid">
          {posts.map((p) => {
            const motif = MOTIFS[hashStr(p.slug) % MOTIFS.length];
            const readTime = readTimeMinutes(p.content);
            const excerpt = p.shortSummary || p.content;
            return (
              <div key={p.slug} className="blog-card-v2">
                <Link href={`/blog/${p.slug}`}>
                  <div className="blog-cover" style={{ background: "var(--lavender)" }}>
                    {p.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- real uploaded blog cover, arbitrary aspect ratio
                      <img src={p.coverImageUrl} alt={p.imageAltText || p.title} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }} />
                    ) : (
                      <svg className="motif" viewBox="0 0 100 100"><Motif kind={motif} color="#2E2442" /></svg>
                    )}
                  </div>
                </Link>
                <div className="blog-body">
                  {(p.categories.length > 0 || p.featured) && (
                    <div className="blog-cat">
                      {p.categories.join(" · ")}
                      {p.featured && <span style={{ color: "var(--coral-deep)" }}> ★ Featured</span>}
                    </div>
                  )}
                  <Link href={`/blog/${p.slug}`}><h3>{p.title}</h3></Link>
                  {p.subtitle && <p style={{ fontSize: 12.5, color: "var(--ink-faint)", margin: "-4px 0 8px" }}>{p.subtitle}</p>}
                  <p>{excerpt.slice(0, 160)}{excerpt.length > 160 ? "…" : ""}</p>
                  <div className="blog-meta">
                    <span>by {bylineFor(p)}</span>
                    <span>{(p.publishAt ?? p.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                  </div>
                  <div className="blog-meta-row">
                    <span>{readTime} min read</span>
                    <span>{p._count.comments} comment{p._count.comments === 1 ? "" : "s"}</span>
                  </div>
                  <Link className="blog-read-more" href={`/blog/${p.slug}`}>Read more →</Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {totalPosts > BLOG_PAGE_SIZE && (
        <nav className="blog-pager" aria-label="Blog pages">
          {page > 1 ? (
            <Link className="blog-pager-btn" href={blogListUrl(page - 1, query)} rel="prev">← Previous</Link>
          ) : (
            <span className="blog-pager-btn disabled" aria-disabled="true">← Previous</span>
          )}
          <span className="blog-pager-pages">
            {pageWindow(page, totalPagesFor(totalPosts)).map((p, i) =>
              p === "gap" ? (
                <span key={`gap-${i}`} className="blog-pager-gap">…</span>
              ) : (
                <Link key={p} className={`blog-pager-num${p === page ? " active" : ""}`} href={blogListUrl(p, query)} aria-current={p === page ? "page" : undefined}>
                  {p}
                </Link>
              )
            )}
          </span>
          {page < totalPagesFor(totalPosts) ? (
            <Link className="blog-pager-btn" href={blogListUrl(page + 1, query)} rel="next">Next →</Link>
          ) : (
            <span className="blog-pager-btn disabled" aria-disabled="true">Next →</span>
          )}
        </nav>
      )}
    </div>
  );
}
