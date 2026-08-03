import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminShell } from "@/components/AdminShell";
import { getSeoOverview, listSeoEntries, listIndexNowLog, listRedirects } from "@/actions/seo-marketing";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { SeoEntryForm } from "./SeoEntryForm";
import { IndexNowPanel } from "./IndexNowPanel";
import { RedirectsManager } from "./RedirectsManager";

/**
 * SEO & Marketing — the admin tab for monitoring and evaluating the SEO/
 * marketing infrastructure: indexable-content health (missing ISBNs/
 * covers that would weaken a book's rich-result eligibility), quick
 * links to every generated feed (sitemaps, RSS), and per-page metadata
 * overrides (SeoEntry — existed in the schema from the start, unused
 * until now).
 */
export default async function SeoMarketingPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "EDITOR") redirect("/account");

  const [overview, entries, indexNowLog, redirects] = await Promise.all([getSeoOverview(), listSeoEntries(), listIndexNowLog(), listRedirects()]);
  const siteUrl = getPublicSiteUrl();

  const feeds = [
    { label: "Sitemap index", href: "/sitemap.xml" },
    { label: "Books sitemap", href: "/sitemap-books.xml" },
    { label: "Blog sitemap", href: "/sitemap-blogs.xml" },
    { label: "Authors sitemap", href: "/sitemap-authors.xml" },
    { label: "Static pages sitemap", href: "/sitemap-static.xml" },
    { label: "RSS feed", href: "/feed.xml" },
    { label: "robots.txt", href: "/robots.txt" },
  ];

  return (
    <AdminShell role={role} activeKey="seo-marketing" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>SEO &amp; Marketing</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Indexable content health, generated feeds, and per-page metadata overrides.
          </p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-label">Published books</div><div className="stat-value">{overview.publishedBooks}</div><div className="stat-sub">Indexable now</div></div>
        <div className="stat-card"><div className="stat-label">Published posts</div><div className="stat-value">{overview.publishedBlogs}</div><div className="stat-sub">Indexable now</div></div>
        <div className="stat-card"><div className="stat-label">Author profiles</div><div className="stat-value">{overview.publishedAuthors}</div><div className="stat-sub">With E-E-A-T pages</div></div>
        <div className="stat-card"><div className="stat-label">Affiliate clicks</div><div className="stat-value">{overview.totalOutboundAffiliateClicks}</div><div className="stat-sub">All time</div></div>
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 14 }}>Content health</h3>
      <div className="map-card" style={{ padding: "6px 16px", marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
          <span>Published books missing an ISBN</span>
          <span className="age-pill" style={overview.booksWithoutIsbn > 0 ? { background: "var(--admin-danger, #EF6262)", color: "#fff" } : undefined}>{overview.booksWithoutIsbn}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
          <span>Published books missing a cover image</span>
          <span className="age-pill" style={overview.booksWithoutCover > 0 ? { background: "var(--admin-danger, #EF6262)", color: "#fff" } : undefined}>{overview.booksWithoutCover}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0" }}>
          <span>Published posts with empty content</span>
          <span className="age-pill" style={overview.blogsWithoutExcerpt > 0 ? { background: "var(--admin-danger, #EF6262)", color: "#fff" } : undefined}>{overview.blogsWithoutExcerpt}</span>
        </div>
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 14 }}>Generated feeds</h3>
      <div className="map-card" style={{ padding: "6px 16px", marginBottom: 24 }}>
        {feeds.map((f) => (
          <div key={f.href} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
            <span>{f.label}</span>
            <a href={`${siteUrl}${f.href}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-small">View</a>
          </div>
        ))}
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 14 }}>Instant indexing (IndexNow)</h3>
      <IndexNowPanel log={indexNowLog} keyFileUrl={`${siteUrl}/indexnow-key.txt`} />

      {role === "ADMIN" && (
        <>
          <h3 style={{ fontSize: 16, marginBottom: 14 }}>Redirects</h3>
          <RedirectsManager redirects={redirects} />

          <h3 style={{ fontSize: 16, marginBottom: 14 }}>Per-page metadata overrides</h3>
          <SeoEntryForm entries={entries} />
        </>
      )}
    </AdminShell>
  );
}
