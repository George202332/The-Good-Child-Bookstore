import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Motif } from "@/components/Motif";
import type { MotifKind } from "@/lib/data/catalog";
import { hashStr } from "@/lib/hash";
import { getPagesContent } from "@/actions/page-content";

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
export default async function BlogListPage() {
  const { blog } = await getPagesContent();
  let posts: PublishedBlog[] = [];
  try {
    const result = await prisma.blog.findMany({
      where: { status: "PUBLISHED", OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] },
      include: { author: true, _count: { select: { comments: true } } },
      orderBy: { publishAt: "desc" },
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
          <p style={{ color: "var(--ink-soft)" }}>{blog.introText}</p>
        </div>
      </div>
      {posts.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>
          Nothing published yet — check back soon.
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
                      <svg className="motif" viewBox="0 0 100 100"><Motif kind={motif} color="#3F3350" /></svg>
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
    </div>
  );
}
