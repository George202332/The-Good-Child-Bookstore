import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";

export const dynamic = "force-dynamic";

/**
 * Public author profile — new page, built for E-E-A-T (Experience,
 * Expertise, Authoritativeness, Trustworthiness): a canonical, linkable
 * URL per author with their real bio, social profiles, and published
 * books, referenced from every book/blog Person schema's `url`/`sameAs`
 * rather than leaving those pointing nowhere.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const siteUrl = getPublicSiteUrl();
  try {
    const author = await prisma.authorProfile.findUnique({ where: { id }, include: { user: true } });
    if (!author) return { title: "Author not found | The Good Child Bookstore" };
    const title = `${author.penName || author.user.name} | The Good Child Bookstore`;
    return {
      title,
      description: author.bio ?? `Books by ${author.penName || author.user.name} on The Good Child Bookstore.`,
      alternates: { canonical: `${siteUrl}/authors/profile/${id}` },
      openGraph: { title, type: "profile" },
    };
  } catch {
    return { title: "Author | The Good Child Bookstore" };
  }
}

export default async function AuthorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const siteUrl = getPublicSiteUrl();

  const author = await prisma.authorProfile.findUnique({
    where: { id },
    include: { user: true, books: { where: { status: "PUBLISHED" } } },
  });
  if (!author) notFound();

  const displayName = author.penName || author.user.name;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: displayName,
    ...(author.bio ? { description: author.bio } : {}),
    url: `${siteUrl}/authors/profile/${id}`,
    ...(author.socialLinks.length > 0 ? { sameAs: author.socialLinks } : {}),
  };
  const breadcrumbLd = breadcrumbJsonLd([
    { name: "Home", url: `${siteUrl}/` },
    { name: "Authorship", url: `${siteUrl}/authors` },
    { name: displayName, url: `${siteUrl}/authors/profile/${id}` },
  ]);

  return (
    <div className="wrap" style={{ paddingTop: 48, paddingBottom: 60, maxWidth: 760, margin: "0 auto" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <div className="breadcrumb"><Link href="/authors">Authorship</Link> › {displayName}</div>
      <h1 style={{ marginTop: 12 }}>{displayName}</h1>
      {author.primaryGenre && <p style={{ color: "var(--ink-faint)", fontSize: 13.5 }}>{author.primaryGenre}</p>}
      {author.bio && <p style={{ marginTop: 16, lineHeight: 1.7 }}>{author.bio}</p>}
      {author.socialLinks.length > 0 && (
        <div style={{ display: "flex", gap: 14, marginTop: 14 }}>
          {author.socialLinks.map((url: string) => (
            <a key={url} href={url} target="_blank" rel="me noopener noreferrer" style={{ fontSize: 13 }}>
              {new URL(url).hostname.replace("www.", "")}
            </a>
          ))}
        </div>
      )}

      <h3 style={{ marginTop: 32, marginBottom: 16 }}>Books by {displayName}</h3>
      {author.books.length === 0 ? (
        <p style={{ color: "var(--ink-faint)", fontSize: 13.5 }}>No published books yet.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
          {author.books.map((b: { id: string; title: string; coverImageUrl: string | null }) => (
            <Link key={b.id} href={`/book/${b.id}`} style={{ textAlign: "center" }}>
              {b.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.coverImageUrl} alt={b.title} style={{ width: "100%", aspectRatio: "2/3", objectFit: "cover", borderRadius: 8 }} />
              ) : (
                <div style={{ width: "100%", aspectRatio: "2/3", background: "var(--lavender)", borderRadius: 8 }} />
              )}
              <div style={{ fontSize: 12.5, marginTop: 6 }}>{b.title}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
