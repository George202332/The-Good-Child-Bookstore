import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardShell } from "@/components/DashboardShell";
import { getMyWallet } from "@/actions/wallet";
import { getMyPayoutRequests, type PayoutRow } from "@/actions/payouts";
import { listMyWiseRecipients } from "@/actions/wise-recipients";
import { RequestPayoutForm } from "@/components/RequestPayoutForm";
import { HOLD_DAYS } from "@/lib/wallet";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";
import { getAffiliateEarningsSummary } from "@/actions/affiliate-earnings-summary";
import { AffiliateEarningsCards } from "../performance/AffiliateEarningsCards";
import { AffiliateCategorySection } from "./AffiliateCategorySection";

interface SaleLineRow {
  id: string;
  grossAmount: unknown;
  authorShare: unknown;
  createdAt: Date;
  book: { title: string };
}
interface AuthorBookWithLines {
  saleLines: SaleLineRow[];
}

/**
 * Revenue — a real, itemized breakdown of every sale line against the
 * author's books, using the confirmed revenue engine (lib/revenue.ts):
 * 75% author share on organic sales, 65% + a separate 10% affiliate cut
 * on affiliate-referred ones. Now includes the real wallet (On Hold /
 * Available, see lib/wallet.ts) and Wise payout requests — previously
 * authors had no payout mechanism at all; only affiliates did.
 */
export default async function RevenuePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AUTHOR") redirect("/account");

  const [user, wallet, payouts, recipients, isAffiliateToo] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      include: { authorProfile: { include: { books: { include: { saleLines: { include: { book: true }, orderBy: { createdAt: "desc" } } } } } } },
    }),
    getMyWallet(),
    getMyPayoutRequests(),
    listMyWiseRecipients(),
    hasAffiliateCapability(session.user.id),
  ]);
  const affiliateEarnings = isAffiliateToo ? await getAffiliateEarningsSummary() : null;
  const books = (user?.authorProfile?.books ?? []) as AuthorBookWithLines[];
  const lines = books.flatMap((b) => b.saleLines);

  return (
    <DashboardShell role="AUTHOR" activeKey="revenue" displayName={session.user.name ?? ""}>
      {affiliateEarnings && (
        <>
          <div className="section-head" style={{ marginBottom: 8 }}>
            <div>
              <h2 style={{ fontSize: 20 }}>Affiliate</h2>
              <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
                Your affiliate programme has two distinct earning categories: each tracked separately with its own
                link and commission structure.
              </p>
            </div>
          </div>
          <AffiliateEarningsCards initial={affiliateEarnings} />
          <AffiliateCategorySection data={affiliateEarnings} />
        </>
      )}

      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Book Revenue</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Your 75% (or 65% on affiliate-referred sales) share of every sale. New sales are On Hold for {HOLD_DAYS}{" "}
            days, then move to Available.
          </p>
        </div>
      </div>
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total earnings</div>
          <div className="stat-value">${wallet.totalEarned.toFixed(2)}</div>
          <div className="stat-sub">All time, {lines.length} sale{lines.length === 1 ? "" : "s"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">On Hold</div>
          <div className="stat-value">${wallet.onHold.toFixed(2)}</div>
          <div className="stat-sub">Released after {HOLD_DAYS} days</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Available</div>
          <div className="stat-value">${wallet.available.toFixed(2)}</div>
          <div className="stat-sub">Ready to request</div>
        </div>
      </div>

      <RequestPayoutForm available={wallet.available} recipients={recipients} />

      <h3 style={{ fontSize: 16, margin: "24px 0 14px" }}>Payout requests</h3>
      {payouts.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>No payout requests yet.</div>
      ) : (
        <div className="map-card" style={{ padding: "6px 16px", marginBottom: 24 }}>
          {payouts.map((p: PayoutRow) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>${p.amount.toFixed(2)}</div>
                <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                  {p.recipientLabel} · requested {p.requestedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </div>
              </div>
              <span className="age-pill">{p.status}</span>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ fontSize: 16, marginBottom: 14 }}>Sale history</h3>
      {lines.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>No sales recorded yet.</div>
      ) : (
        <div className="map-card" style={{ padding: "6px 16px" }}>
          {lines.map((l) => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{l.book.title}</div>
                <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                  {l.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} · gross ${Number(l.grossAmount).toFixed(2)}
                </div>
              </div>
              <div style={{ fontWeight: 700 }}>${Number(l.authorShare).toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
