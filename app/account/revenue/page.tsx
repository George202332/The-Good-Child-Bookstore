import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";

interface SaleLineRow {
  id: string;
  isbn: string | null;
  grossAmount: unknown;
  companyShare: unknown;
  affiliateShare: unknown;
  authorShare: unknown;
  saleType: string;
  format: string | null;
  createdAt: Date;
  book: {
    title: string;
    isbn: string | null;
    hasEbook: boolean;
    hasPrint: boolean;
    hasAudiobook: boolean;
  };
}
interface AuthorBookWithLines {
  saleLines: Omit<SaleLineRow, "isbn">[];
}

const FORMAT_LABEL: Record<string, string> = { ebook: "eBook", paperback: "Paperback", hardcover: "Hardcover", audiobook: "Audiobook" };

/** Every real sale always has an actual format on it going forward
 * (checkout requires picking one) — this fallback only covers sales
 * made before that existed, so the column is never blank. */
function formatLabelFor(format: string | null, book: { hasEbook: boolean; hasPrint: boolean; hasAudiobook: boolean }): string {
  if (format) return FORMAT_LABEL[format] ?? format;
  if (book.hasEbook) return "eBook";
  if (book.hasPrint) return "Hardcover";
  if (book.hasAudiobook) return "Audiobook";
  return "eBook";
}

const TABLE_HEAD_STYLE: React.CSSProperties = { padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap" };
const TABLE_CELL_STYLE: React.CSSProperties = { padding: "10px 16px", borderBottom: "1px solid var(--line)" };

/**
 * Revenue — purely informational: every dollar you've earned, broken
 * down by exactly where it came from (book sales, author referrals you
 * brought in, or book promotions via your affiliate links), with a
 * fully detailed table for each. Actually requesting or tracking a
 * payout lives on Payout Settings, the dedicated tab for moving money —
 * this page is just for understanding where your earnings come from.
 */
export default async function RevenuePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AUTHOR") redirect("/account");

  const isAffiliateToo = await hasAffiliateCapability(session.user.id);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      authorProfile: {
        include: {
          books: {
            include: {
              saleLines: { include: { book: true }, orderBy: { createdAt: "desc" } },
            },
          },
        },
      },
      affiliateProfile: {
        include: {
          authorReferralEarnings: {
            include: {
              book: {
                include: {
                  author: { include: { user: true } },
                },
              },
            },
            orderBy: { createdAt: "desc" },
          },
          affiliateLinks: {
            include: {
              saleLines: { include: { book: true }, orderBy: { createdAt: "desc" } },
            },
          },
        },
      },
    },
  });

  const myDisplayName = user?.authorProfile?.penName || user?.name || "";
  const books = (user?.authorProfile?.books ?? []) as AuthorBookWithLines[];
  const bookSaleLines = books.flatMap((b) => b.saleLines);
  const bookSalesTotal = bookSaleLines.reduce((s, l) => s + Number(l.authorShare), 0);

  type ReferralSaleLine = {
    id: string;
    createdAt: Date;
    companyShare: unknown;
    authorReferralShare: unknown;
    book: { author: { id: string; penName: string | null; user: { name: string; accountNumber: string; createdAt: Date } } };
  };
  const referralSaleLines = (user?.affiliateProfile?.authorReferralEarnings ?? []) as ReferralSaleLine[];

  // Group referral earnings by the referred author — one row per author,
  // not per sale, since "Date Joined" and "Account ID" are per-author facts.
  const referralByAuthor = new Map<string, { accountId: string; name: string; dateJoined: Date; revenue: number; commission: number }>();
  for (const l of referralSaleLines) {
    const key = l.book.author.id;
    const existing = referralByAuthor.get(key);
    const revenue = Number(l.companyShare);
    const commission = Number(l.authorReferralShare);
    if (existing) {
      existing.revenue += revenue;
      existing.commission += commission;
    } else {
      referralByAuthor.set(key, {
        accountId: l.book.author.user.accountNumber,
        name: l.book.author.penName || l.book.author.user.name,
        dateJoined: l.book.author.user.createdAt,
        revenue,
        commission,
      });
    }
  }
  const referralRows = Array.from(referralByAuthor.values());
  const referralTotal = referralRows.reduce((s, r) => s + r.commission, 0);

  type PromotionSaleLine = {
    id: string;
    createdAt: Date;
    format: string | null;
    affiliateShare: unknown;
    book: {
      id: string;
      title: string;
      isbn: string | null;
      hasEbook: boolean;
      hasPrint: boolean;
      hasAudiobook: boolean;
      ebookPrice: unknown;
      paperbackPrice: unknown;
      hardcoverPrice: unknown;
      audiobookPrice: unknown;
      author: { penName: string | null; user: { name: string } };
    };
  };
  const promotionSaleLines: PromotionSaleLine[] = (user?.affiliateProfile?.affiliateLinks ?? []).flatMap(
    (l: { saleLines: PromotionSaleLine[] }) => l.saleLines
  );

  function listPriceFor(book: PromotionSaleLine["book"], format: string | null): number {
    const f = format ?? (book.hasEbook ? "ebook" : book.hasPrint ? "hardcover" : "audiobook");
    const perFormat = f === "ebook" ? book.ebookPrice : f === "paperback" ? book.paperbackPrice : f === "hardcover" ? book.hardcoverPrice : book.audiobookPrice;
    return perFormat !== null && perFormat !== undefined ? Number(perFormat) : 0;
  }

  // Group promotion earnings by book + format — "Copies" only makes
  // sense as a count across multiple sales of the same edition.
  const promotionByBookFormat = new Map<string, { isbn: string | null; title: string; author: string; format: string; price: number; copies: number; commission: number }>();
  for (const l of promotionSaleLines) {
    const formatKey = l.format ?? "ebook";
    const key = `${l.book.id}:${formatKey}`;
    const existing = promotionByBookFormat.get(key);
    const commission = Number(l.affiliateShare);
    if (existing) {
      existing.copies += 1;
      existing.commission += commission;
    } else {
      promotionByBookFormat.set(key, {
        isbn: l.book.isbn,
        title: l.book.title,
        author: l.book.author.penName || l.book.author.user.name,
        format: formatLabelFor(l.format, l.book),
        price: listPriceFor(l.book, l.format),
        copies: 1,
        commission,
      });
    }
  }
  const promotionRows = Array.from(promotionByBookFormat.values());
  const promotionTotal = promotionRows.reduce((s, r) => s + r.commission, 0);

  const grandTotal = bookSalesTotal + referralTotal + promotionTotal;

  return (
    <DashboardShell role="AUTHOR" activeKey="revenue" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Revenue</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Every dollar you&apos;ve earned, broken down by exactly where it came from. To request a payout, see
            Payout Settings.
          </p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 28 }}>
        <div className="stat-card stat-card-referral">
          <div className="stat-label">Total earnings</div>
          <div className="stat-value">${grandTotal.toFixed(2)}</div>
          <div className="stat-sub">All time; every source combined</div>
        </div>
        <div className="stat-card stat-card-promotion">
          <div className="stat-label">Book sales</div>
          <div className="stat-value">${bookSalesTotal.toFixed(2)}</div>
          <div className="stat-sub">Your royalty on {bookSaleLines.length} sale{bookSaleLines.length === 1 ? "" : "s"}</div>
        </div>
        <div className="stat-card stat-card-total">
          <div className="stat-label">Referral revenue</div>
          <div className="stat-value">${referralTotal.toFixed(2)}</div>
          <div className="stat-sub">From {referralRows.length} referred author{referralRows.length === 1 ? "" : "s"}</div>
        </div>
        <div className="stat-card stat-card-due">
          <div className="stat-label">Book promotion</div>
          <div className="stat-value">${promotionTotal.toFixed(2)}</div>
          <div className="stat-sub">10% commission on {promotionSaleLines.length} sale{promotionSaleLines.length === 1 ? "" : "s"}</div>
        </div>
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 14 }}>Book Sales</h3>
      {bookSaleLines.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13, marginBottom: 24 }}>No sales recorded yet.</div>
      ) : (
        <div className="map-card" style={{ padding: 0, overflowX: "auto", marginBottom: 28 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["S/N", "Date", "Title", "Format", "Author", "Sale Type", "Price", "Company", "Affiliate", "Royalty"].map((h) => (
                  <th key={h} style={TABLE_HEAD_STYLE}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookSaleLines.map((l, i) => (
                <tr key={l.id}>
                  <td style={TABLE_CELL_STYLE}>{l.book.isbn ?? `#${i + 1}`}</td>
                  <td style={TABLE_CELL_STYLE}>{l.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td style={TABLE_CELL_STYLE}>{l.book.title}</td>
                  <td style={TABLE_CELL_STYLE}>{formatLabelFor(l.format, l.book)}</td>
                  <td style={TABLE_CELL_STYLE}>{myDisplayName}</td>
                  <td style={TABLE_CELL_STYLE}><span className="age-pill">{l.saleType === "AFFILIATE" ? "Affiliate" : "Organic"}</span></td>
                  <td style={TABLE_CELL_STYLE}>${Number(l.grossAmount).toFixed(2)}</td>
                  <td style={TABLE_CELL_STYLE}>${Number(l.companyShare).toFixed(2)}</td>
                  <td style={TABLE_CELL_STYLE}>${Number(l.affiliateShare).toFixed(2)}</td>
                  <td style={{ ...TABLE_CELL_STYLE, fontWeight: 700 }}>${Number(l.authorShare).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isAffiliateToo && (
        <>
          <h3 style={{ fontSize: 16, marginBottom: 14 }}>Referral Revenue</h3>
          {referralRows.length === 0 ? (
            <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13, marginBottom: 24 }}>No referral revenue yet.</div>
          ) : (
            <div className="map-card" style={{ padding: 0, overflowX: "auto", marginBottom: 28 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Account ID", "Name", "Date Joined", "Revenue", "Commission"].map((h) => (
                      <th key={h} style={TABLE_HEAD_STYLE}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {referralRows.map((r) => (
                    <tr key={r.accountId}>
                      <td style={{ ...TABLE_CELL_STYLE, fontFamily: "monospace" }}>{r.accountId}</td>
                      <td style={TABLE_CELL_STYLE}>{r.name}</td>
                      <td style={TABLE_CELL_STYLE}>{r.dateJoined.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                      <td style={TABLE_CELL_STYLE}>${r.revenue.toFixed(2)}</td>
                      <td style={{ ...TABLE_CELL_STYLE, fontWeight: 700 }}>${r.commission.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 style={{ fontSize: 16, marginBottom: 14 }}>Book Promotion</h3>
          {promotionRows.length === 0 ? (
            <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>No promotion earnings yet.</div>
          ) : (
            <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["SN/ISBN", "Title", "Author", "Format", "Price", "Copies", "Commission"].map((h) => (
                      <th key={h} style={TABLE_HEAD_STYLE}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {promotionRows.map((r, i) => (
                    <tr key={`${r.title}-${r.format}-${i}`}>
                      <td style={TABLE_CELL_STYLE}>{r.isbn ?? `#${i + 1}`}</td>
                      <td style={TABLE_CELL_STYLE}>{r.title}</td>
                      <td style={TABLE_CELL_STYLE}>{r.author}</td>
                      <td style={TABLE_CELL_STYLE}>{r.format}</td>
                      <td style={TABLE_CELL_STYLE}>${r.price.toFixed(2)}</td>
                      <td style={TABLE_CELL_STYLE}>{r.copies}</td>
                      <td style={{ ...TABLE_CELL_STYLE, fontWeight: 700 }}>${r.commission.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </DashboardShell>
  );
}
