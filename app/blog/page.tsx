import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Motif } from "@/components/Motif";
import type { MotifKind } from "@/lib/data/catalog";
import { hashStr } from "@/lib/hash";

export const dynamic = "force-dynamic";

const MOTIFS: MotifKind[] = ["owl", "leaf", "star", "moon", "heart", "tree"];

interface PublishedBlog {
  slug: string;
  title: string;
  content: string;
  publishAt: Date | null;
  createdAt: Date;
  author: { user: { name: string } };
}

/** Public blog listing — real published posts only (status PUBLISHED). */
export default async function BlogListPage() {
  let posts: PublishedBlog[] = [];
  try {
    const result = await prisma.blog.findMany({
      where: { status: "PUBLISHED" },
      include: { author: { include: { user: true } } },
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
          <h1>The Journal</h1>
          <p style={{ color: "var(--ink-soft)" }}>Notes from our authors and the shelf team.</p>
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
            return (
              <Link key={p.slug} href={`/blog/${p.slug}`} className="blog-card">
                <div className="blog-cover" style={{ background: "var(--lavender)" }}>
                  <svg className="motif" viewBox="0 0 100 100"><Motif kind={motif} color="#3F3350" /></svg>
                </div>
                <div className="blog-body">
                  <h3>{p.title}</h3>
                  <p>{p.content.slice(0, 160)}{p.content.length > 160 ? "…" : ""}</p>
                  <div className="blog-meta">
                    <span>{p.author.user.name}</span>
                    <span>{(p.publishAt ?? p.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
