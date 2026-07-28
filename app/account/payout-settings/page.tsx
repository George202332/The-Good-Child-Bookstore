import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { listMyWiseRecipients } from "@/actions/wise-recipients";
import { getMyWallet } from "@/actions/wallet";
import { getMyPayoutRequests, type PayoutRow } from "@/actions/payouts";
import { RecipientManager } from "./RecipientManager";
import { AutoPayoutInfo } from "@/components/AutoPayoutInfo";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";

/**
 * Payout Settings — the one place to manage where earnings are sent
 * (Wise recipients), see how the automatic payout schedule applies to
 * you, and see payout history. Payouts are no longer requested
 * manually — everything earned in a calendar month is automatically
 * queued for payment on the 15th of the following month (see
 * app/api/cron/monthly-payouts/route.ts). Shared between Author and
 * Affiliate roles (and a Reader who's enabled affiliate access) — an
 * Author's balance combines both their book-revenue and
 * affiliate-earnings wallets, matching how the Dashboard already
 * presents a combined figure.
 */
export default async function PayoutSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  const isAffiliateToo = await hasAffiliateCapability(session.user.id);
  if (role !== "AUTHOR" && role !== "AFFILIATE" && !isAffiliateToo) redirect("/account");

  const [recipients, payouts] = await Promise.all([listMyWiseRecipients(), getMyPayoutRequests()]);

  let available = 0;
  let onHold = 0;
  let nextReleaseDate: string | null = null;
  if (role === "AUTHOR") {
    const authorWallet = await getMyWallet("author");
    available += authorWallet.available;
    onHold += authorWallet.onHold;
    nextReleaseDate = authorWallet.nextReleaseDate;
    if (isAffiliateToo) {
      const affiliateWallet = await getMyWallet("affiliate");
      available += affiliateWallet.available;
      onHold += affiliateWallet.onHold;
      if (affiliateWallet.nextReleaseDate && (!nextReleaseDate || affiliateWallet.nextReleaseDate < nextReleaseDate)) {
        nextReleaseDate = affiliateWallet.nextReleaseDate;
      }
    }
  } else {
    const wallet = await getMyWallet("affiliate");
    available = wallet.available;
    onHold = wallet.onHold;
    nextReleaseDate = wallet.nextReleaseDate;
  }

  return (
    <DashboardShell role={role} activeKey="payout-settings" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Payout Settings</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Where your earnings are sent. All payouts are processed through Wise, so you can receive money via
            M-Pesa, bank transfer, and anything else Wise supports.
          </p>
        </div>
      </div>
      <RecipientManager initial={recipients} />

      <h3 style={{ fontSize: 16, margin: "28px 0 14px" }}>Your payout schedule</h3>
      <AutoPayoutInfo available={available} onHold={onHold} nextReleaseDate={nextReleaseDate} hasRecipient={recipients.length > 0} />

      <h3 style={{ fontSize: 16, margin: "24px 0 14px" }}>Payout history</h3>
      {payouts.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>No payouts yet.</div>
      ) : (
        <div className="map-card" style={{ padding: "6px 16px" }}>
          {payouts.map((p: PayoutRow) => (
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
