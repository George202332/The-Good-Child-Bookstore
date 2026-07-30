import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { getMyWallet } from "@/actions/wallet";
import { getMyPayoutRequests } from "@/actions/payouts";
import { listMyWiseRecipients } from "@/actions/wise-recipients";
import { AutoPayoutInfo } from "@/components/AutoPayoutInfo";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";

/**
 * Affiliate Earnings — real wallet (On Hold / Available, see
 * lib/wallet.ts) and real payout history. Payouts are automatic now —
 * everything earned in a calendar month is queued for payment on the
 * 15th of the following month (see
 * app/api/cron/monthly-payouts/route.ts), so there's no "request a
 * payout" button here anymore. Reachable by a dedicated Affiliate
 * account, or a Reader/Author who's enabled affiliate access from
 * their own dashboard (see actions/reader-affiliate.ts) — the real
 * signal is having an AffiliateProfile, not the primary role.
 */
export default async function EarningsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (!(await hasAffiliateCapability(session.user.id))) redirect("/account");

  const [wallet, payouts, recipients] = await Promise.all([getMyWallet("affiliate"), getMyPayoutRequests(), listMyWiseRecipients()]);

  return (
    <DashboardShell role={role} activeKey="earnings" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Earnings</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Your commission wallet. Everything earned in a calendar month is automatically paid out on the 15th of
            the following month.
          </p>
        </div>
      </div>
      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total earned</div>
          <div className="stat-value">${wallet.totalEarned.toFixed(2)}</div>
          <div className="stat-sub">All time, from {wallet.saleCount} sale{wallet.saleCount === 1 ? "" : "s"}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">On Hold</div>
          <div className="stat-value">${wallet.onHold.toFixed(2)}</div>
          <div className="stat-sub">
            {wallet.nextReleaseDate
              ? `Releases ${new Date(wallet.nextReleaseDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`
              : "Nothing on hold"}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Available</div>
          <div className="stat-value">${wallet.available.toFixed(2)}</div>
          <div className="stat-sub">Automatically paid on the 15th</div>
        </div>
      </div>

      <AutoPayoutInfo available={wallet.available} onHold={wallet.onHold} nextReleaseDate={wallet.nextReleaseDate} hasRecipient={recipients.length > 0} />

      <h3 style={{ fontSize: 16, margin: "24px 0 14px" }}>Payout history</h3>
      {payouts.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>No payouts yet.</div>
      ) : (
        <div className="map-card" style={{ padding: "6px 16px" }}>
          {payouts.map((p) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>${p.amount.toFixed(2)}</div>
                <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>
                  {p.recipientLabel}; queued {p.requestedAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </div>
              </div>
              <span className="age-pill">{p.status}</span>
            </div>
          ))}
        </div>
      )}
    </DashboardShell>
  );
}
