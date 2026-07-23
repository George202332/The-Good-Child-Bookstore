import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { getMyWallet } from "@/actions/wallet";
import { getMyPayoutRequests } from "@/actions/payouts";
import { listMyWiseRecipients } from "@/actions/wise-recipients";
import { RequestPayoutForm } from "@/components/RequestPayoutForm";
import { HOLD_DAYS } from "@/lib/wallet";

/**
 * Affiliate Earnings — real wallet (On Hold / Available, see
 * lib/wallet.ts) and real payout requests via Wise. Replaces the
 * original's simulated buildAffEarningsTimeline() fake monthly numbers.
 */
export default async function EarningsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AFFILIATE") redirect("/account");

  const [wallet, payouts, recipients] = await Promise.all([getMyWallet(), getMyPayoutRequests(), listMyWiseRecipients()]);

  return (
    <DashboardShell role="AFFILIATE" activeKey="earnings" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Earnings</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Your commission wallet. New sales are On Hold for {HOLD_DAYS} days, then move to Available.
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
        <div className="map-card" style={{ padding: "6px 16px" }}>
          {payouts.map((p) => (
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
    </DashboardShell>
  );
}
