import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { bookAuthorDisplayName } from "@/lib/book-author-name";

export const dynamic = "force-dynamic";

type ProfileBook = {
  id: string;
  title: string;
  slug: string;
  coverImageUrl: string | null;
  createdAt: Date;
  submissionMetadata: unknown;
};

/** The name this profile should show: the specific pen name that was
 * clicked from the Authors list (passed through as `?name=`), so a
 * single account with multiple pen names across different books keeps
 * showing whichever one the reader actually followed/clicked — never
 * falls back to the real account name just because it's reached here.
 * With no `?name=` (a direct link, the sitemap, a schema URL), fall
 * back to the most recently published book's resolved name — the same
 * priority order (submission-time name, then standing pen name, then
 * real name) used everywhere else a book's author name is shown — and
 * only fall all the way to the real account name if the author has no
 * published books at all. */
function resolveDisplayName(
  requestedName: string | null | undefined,
  author: { penName: string | null; user: { name: string } },
  books: ProfileBook[],
): string {
  if (requestedName && requestedName.trim()) return requestedName.trim();
  if (books.length > 0) {
    const mostRecent = [...books].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    return bookAuthorDisplayName({ submissionMetadata: mostRecent.submissionMetadata, author });
  }
  return author.penName || author.user.name;
}

/**
 * Public author profile — new page, built for E-E-A-T (Experience,
 * Expertise, Authoritativeness, Trustworthiness): a canonical, linkable
 * URL per author with their real bio, social profiles, and published
 * books, referenced from every book/blog Person schema's `url`/`sameAs`
 * rather than leaving those pointing nowhere.
 */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ name?: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { name } = await searchParams;
  const siteUrl = getPublicSiteUrl();
  try {
    const author = await prisma.authorProfile.findUnique({
      where: { id },
      include: {
        user: true,
        books: { where: { status: "PUBLISHED" }, select: { id: true, title: true, slug: true, coverImageUrl: true, createdAt: true, submissionMetadata: true } },
      },
    });
    if (!author) return { title: "Author not found | The Good Child Bookstore" };
    const displayName = resolveDisplayName(name, author, author.books);
    const title = `${displayName} | The Good Child Bookstore`;
    return {
      title,
      description: author.bio ?? `Books by ${displayName} on The Good Child Bookstore.`,
      alternates: { canonical: `${siteUrl}/authors/profile/${id}` },
      openGraph: { title, type: "profile" },
    };
  } catch {
    return { title: "Author | The Good Child Bookstore" };
  }
}

export default async function AuthorProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ name?: string }>;
}) {
  const { id } = await params;
  const { name } = await searchParams;
  const siteUrl = getPublicSiteUrl();

  const author = await prisma.authorProfile.findUnique({
    where: { id },
    include: {
      user: true,
      books: { where: { status: "PUBLISHED" }, select: { id: true, title: true, slug: true, coverImageUrl: true, createdAt: true, submissionMetadata: true } },
    },
  });
  if (!author) notFound();

  const displayName = resolveDisplayName(name, author, author.books);
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

  // Account details appropriate for a fully public, unauthenticated
  // page: nothing financial or private (no account number, no gender,
  // no referral source) — just what the author has chosen to make
  // visible about themselves. Email is included only when the author
  // has explicitly opted into showing it publicly.
  const detailRows: { label: string; value: string }[] = [];
  if (author.country) detailRows.push({ label: "Location", value: author.country });
  if (author.availableForCollabs) detailRows.push({ label: "Open to collaborations", value: "Yes" });
  if (author.pressKitUrl) detailRows.push({ label: "Press kit", value: author.pressKitUrl });
  if (author.showEmailPublicly && author.user.email) detailRows.push({ label: "Email", value: author.user.email });

  return (
    <div className="wrap" style={{ paddingTop: 48, paddingBottom: 60 }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <div style={{ maxWidth: 760 }}>
        <div className="breadcrumb"><Link href="/authors">Authorship</Link> › {displayName}</div>
        <h1 style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
          {displayName}
          {author.user.emailVerifiedAt && (
            <span
              title="Verified author"
              style={{ fontSize: 12, fontWeight: 700, padding: "2px 10px", borderRadius: 999, background: "rgba(31,107,72,0.12)", color: "#165236" }}
            >
              ✓ Verified
            </span>
          )}
        </h1>
        {author.primaryGenre && <p style={{ color: "var(--ink-faint)", fontSize: 13.5 }}>{author.primaryGenre}</p>}
        {author.bio && <p style={{ marginTop: 16, lineHeight: 1.7 }}>{author.bio}</p>}
        {author.socialLinks.length > 0 && (
          <div style={{ display: "flex", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
            {author.socialLinks.map((url: string) => (
              <a key={url} href={url} target="_blank" rel="me noopener noreferrer" style={{ fontSize: 13 }}>
                {new URL(url).hostname.replace("www.", "")}
              </a>
            ))}
          </div>
        )}

        {detailRows.length > 0 && (
          <div className="map-card" style={{ marginTop: 20, padding: "6px 16px" }}>
            {detailRows.map((r) => (
              <div key={r.label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line)", fontSize: 13.5 }}>
                <span style={{ color: "var(--ink-faint)" }}>{r.label}</span>
                <span style={{ fontWeight: 600, textAlign: "right" }}>{r.value}</span>
              </div>
            ))}
          </div>
        )}

        <h3 style={{ marginTop: 32, marginBottom: 16 }}>Books by {displayName}</h3>
        {author.books.length === 0 ? (
          <p style={{ color: "var(--ink-faint)", fontSize: 13.5 }}>No published books yet.</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
            {author.books.map((b: ProfileBook) => (
              <Link key={b.id} href={`/${b.slug}`} style={{ textAlign: "center" }}>
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
    </div>
  );
}
