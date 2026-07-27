import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";

interface SaleLineRow {
  id: string;
  grossAmount: unknown;
  authorShare: unknown;
  saleType: string;
  format: string | null;
  createdAt: Date;
  book: { title: string };
}
interface AuthorBookWithLines {
  saleLines: SaleLineRow[];
}

const FORMAT_LABEL: Record<string, string> = { ebook: "eBook", paperback: "Paperback", hardcover: "Hardcover", audiobook: "Audiobook" };

/**
 * Revenue — purely informational: every dollar you've earned, broken
 * down by exactly where it came from (book sales, author referrals you
 * brought in, or book promotions via your affiliate links), with a
 * detailed table for each. Actually requesting or tracking a payout now
 * lives on Payout Settings, since that's the dedicated tab for moving
 * money — this page is just for understanding where your earnings come
 * from.
 */
export default async function RevenuePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AUTHOR") redirect("/account");

  const isAffiliateToo = await hasAffiliateCapability(session.user.id);

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      authorProfile: { include: { books: { include: { saleLines: { include: { book: true }, orderBy: { createdAt: "desc" } } } } } },
      affiliateProfile: isAffiliateToo
        ? {
            include: {
              authorReferralEarnings: { include: { book: { include: { author: { include: { user: true } } } } }, orderBy: { createdAt: "desc" } },
              affiliateLinks: { include: { saleLines: { include: { book: true }, orderBy: { createdAt: "desc" } } } },
            },
          }
        : false,
    },
  });

  const books = (user?.authorProfile?.books ?? []) as AuthorBookWithLines[];
  const bookSaleLines = books.flatMap((b) => b.saleLines);
  const bookSalesTotal = bookSaleLines.reduce((s, l) => s + Number(l.authorShare), 0);

  type ReferralRow = { id: string; createdAt: Date; grossAmount: unknown; authorReferralShare: unknown; book: { title: string; author: { user: { name: string } } } };
  const referralLines = ((user?.affiliateProfile?.authorReferralEarnings ?? []) as ReferralRow[]);
  const referralTotal = referralLines.reduce((s, l) => s + Number(l.authorReferralShare), 0);

  type PromotionRow = { id: string; createdAt: Date; grossAmount: unknown; affiliateShare: unknown; book: { title: string } };
  const promotionLines: PromotionRow[] = (user?.affiliateProfile?.affiliateLinks ?? []).flatMap((l: { saleLines: PromotionRow[] }) => l.saleLines);
  const promotionTotal = promotionLines.reduce((s, l) => s + Number(l.affiliateShare), 0);

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
          <div className="stat-sub">Your author share of {bookSaleLines.length} sale{bookSaleLines.length === 1 ? "" : "s"}</div>
        </div>
        <div className="stat-card stat-card-total">
          <div className="stat-label">Author referrals</div>
          <div className="stat-value">${referralTotal.toFixed(2)}</div>
          <div className="stat-sub">3% commission from {referralLines.length} sale{referralLines.length === 1 ? "" : "s"}</div>
        </div>
        <div className="stat-card stat-card-due">
          <div className="stat-label">Book promotions</div>
          <div className="stat-value">${promotionTotal.toFixed(2)}</div>
          <div className="stat-sub">10% commission from {promotionLines.length} sale{promotionLines.length === 1 ? "" : "s"}</div>
        </div>
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 14 }}>Book sales</h3>
      {bookSaleLines.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13, marginBottom: 24 }}>No sales recorded yet.</div>
      ) : (
        <div className="map-card" style={{ padding: 0, overflowX: "auto", marginBottom: 28 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {["Book", "Date", "Format", "Sale type", "Gross", "Your share"].map((h) => (
                  <th key={h} style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11.5, textTransform: "uppercase", textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bookSaleLines.map((l) => (
                <tr key={l.id}>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{l.book.title}</td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{l.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{l.format ? FORMAT_LABEL[l.format] ?? l.format : "—"}</td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}><span className="age-pill">{l.saleType === "AFFILIATE" ? "Affiliate" : "Organic"}</span></td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>${Number(l.grossAmount).toFixed(2)}</td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", fontWeight: 700 }}>${Number(l.authorShare).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isAffiliateToo && (
        <>
          <h3 style={{ fontSize: 16, marginBottom: 14 }}>Author referrals</h3>
          {referralLines.length === 0 ? (
            <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13, marginBottom: 24 }}>No author-referral earnings yet.</div>
          ) : (
            <div className="map-card" style={{ padding: 0, overflowX: "auto", marginBottom: 28 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Referred author", "Book sold", "Date", "Gross sale", "Your 3% share"].map((h) => (
                      <th key={h} style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11.5, textTransform: "uppercase", textAlign: "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {referralLines.map((l) => (
                    <tr key={l.id}>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{l.book.author.user.name}</td>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{l.book.title}</td>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{l.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>${Number(l.grossAmount).toFixed(2)}</td>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", fontWeight: 700 }}>${Number(l.authorReferralShare).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h3 style={{ fontSize: 16, marginBottom: 14 }}>Book promotions</h3>
          {promotionLines.length === 0 ? (
            <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>No promotion earnings yet.</div>
          ) : (
            <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["Book", "Date", "Gross sale", "Your 10% share"].map((h) => (
                      <th key={h} style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11.5, textTransform: "uppercase", textAlign: "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {promotionLines.map((l) => (
                    <tr key={l.id}>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{l.book.title}</td>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{l.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>${Number(l.grossAmount).toFixed(2)}</td>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", fontWeight: 700 }}>${Number(l.affiliateShare).toFixed(2)}</td>
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
