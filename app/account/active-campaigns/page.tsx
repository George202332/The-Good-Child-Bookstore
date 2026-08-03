import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";
import { listMyAffiliateLinks } from "@/actions/affiliate";
import { getRealPublishedBooks } from "@/lib/data/real-books-adapter";
import { BOOKS } from "@/lib/data/catalog";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { CopyLinkButton } from "./CopyLinkButton";
import { BrowseBooksSection } from "./BrowseBooksSection";

/**
 * Promotions — redesigned as a single page: 4 stat cards, then Browse
 * all books (only books this affiliate isn't already promoting — once
 * a link is generated for one, it moves out of this list and into the
 * table below instead, matching "a book already on promotion is no
 * longer in the list of all books to promote"), then Books on
 * Promotion. Absorbs what used to be the separate /account/promotions
 * browse page — that route now just redirects here.
 */
export default async function ActiveCampaignsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (!(await hasAffiliateCapability(session.user.id))) redirect("/account");

  const [links, realBooks] = await Promise.all([listMyAffiliateLinks(), getRealPublishedBooks()]);
  const siteUrl = getPublicSiteUrl();
  const totalClicks = links.reduce((s, l) => s + l.clicks, 0);
  const totalConversions = links.reduce((s, l) => s + l.conversions, 0);
  const totalEarned = links.reduce((s, l) => s + l.commissionEarned, 0);
  const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

  const promotedBookIds = new Set(links.filter((l) => l.bookId).map((l) => l.bookId as string));
  const allBooks = [...realBooks, ...BOOKS];
  const browsable = allBooks
    .filter((b) => b.affiliateEnabled && !promotedBookIds.has(b.id))
    .map((b) => ({ id: b.id, sn: b.isbn, title: b.title, author: b.author, price: b.price, category: b.category, genre: b.genre, pubDate: b.pubDate }));

  return (
    <DashboardShell role={role} activeKey="active-campaigns" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Promotions</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Sharing a book&apos;s link anywhere: a blog post, social media, email, wherever, earns you a commission
            whenever someone buys through it, in any format.
          </p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card stat-card-referral">
          <div className="stat-label">Books Sold</div>
          <div className="stat-value">{totalConversions}</div>
          <div className="stat-sub">Through your links</div>
        </div>
        <div className="stat-card stat-card-promotion">
          <div className="stat-label">Total Clicks</div>
          <div className="stat-value">{totalClicks}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card stat-card-total">
          <div className="stat-label">Conversion Rate</div>
          <div className="stat-value">{conversionRate.toFixed(1)}%</div>
          <div className="stat-sub">Clicks that became a sale</div>
        </div>
        <div className="stat-card stat-card-due">
          <div className="stat-label">Commission Earned</div>
          <div className="stat-value">${totalEarned.toFixed(2)}</div>
          <div className="stat-sub">All time</div>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <BrowseBooksSection books={browsable} />
      </div>

      <h3 style={{ fontSize: 16, margin: "0 0 14px" }}>Books on Promotion</h3>
      <div className="map-card" style={{ padding: 20 }}>
        {links.length === 0 ? (
          <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>
            You&apos;re not promoting any books yet — browse all books above to generate your first link.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={TABLE_HEAD_STYLE}>Book</th>
                  <th style={TABLE_HEAD_STYLE}>Link</th>
                  <th style={TABLE_HEAD_STYLE}>Clicks</th>
                  <th style={TABLE_HEAD_STYLE}>Sales</th>
                  <th style={TABLE_HEAD_STYLE}>Earned</th>
                  <th style={TABLE_HEAD_STYLE}></th>
                </tr>
              </thead>
              <tbody>
                {links.map((l) => {
                  const url = `${siteUrl}/book/${l.bookId}?aff=${l.code}`;
                  return (
                    <tr key={l.id}>
                      <td style={TABLE_CELL_STYLE}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          {l.bookCoverUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- small promotion-table thumbnail
                            <img src={l.bookCoverUrl} alt={l.bookTitle} style={{ width: 32, aspectRatio: "2/3", objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: 32, aspectRatio: "2/3", background: "var(--lavender)", borderRadius: 4, flexShrink: 0 }} />
                          )}
                          <span style={{ fontWeight: 700 }}>{l.bookTitle}</span>
                        </div>
                      </td>
                      <td style={TABLE_CELL_STYLE}><code style={{ fontSize: 11.5, wordBreak: "break-all" }}>{url}</code></td>
                      <td style={TABLE_CELL_STYLE}>{l.clicks}</td>
                      <td style={TABLE_CELL_STYLE}>{l.conversions}</td>
                      <td style={TABLE_CELL_STYLE}>${l.commissionEarned.toFixed(2)}</td>
                      <td style={TABLE_CELL_STYLE}><CopyLinkButton url={url} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

const TABLE_HEAD_STYLE: React.CSSProperties = { padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap" };
const TABLE_CELL_STYLE: React.CSSProperties = { padding: "10px 16px", borderBottom: "1px solid var(--line)" };
