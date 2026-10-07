import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { AutoPayoutInfo } from "@/components/AutoPayoutInfo";
import { LiveRefresher } from "@/components/LiveRefresher";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";
import { computeMonthlyPayoutRows, computePayoutStatCards } from "@/lib/payout-monthly";
import { getMyWallet } from "@/actions/wallet";
import { ColHelp } from "@/components/ColHelp";
import { MIN_PAYOUT_AMOUNT } from "@/lib/payout-threshold";
import { authorStatusLabel, authorStatusHelp, authorStatusPillStyle, STATUS_COLUMN_HELP, LIVE_LABEL, ROLLED_LABEL, PENDING_LABEL } from "@/lib/payout-status";
import { TH_STYLE, TD_STYLE } from "@/components/admin-table";

const TABLE_HEAD_STYLE: React.CSSProperties = { ...TH_STYLE, padding: "12px 16px", fontSize: 11, letterSpacing: undefined };
const TABLE_CELL_STYLE: React.CSSProperties = { ...TD_STYLE, padding: "10px 16px", fontSize: undefined, verticalAlign: undefined };

/**
 * Payout Settings — where earnings are sent now lives on Profile (see
 * PaymentDetailsSection there) per explicit instruction; this page is
 * now purely about the payout schedule and history: 4 rolling stat
 * cards (Lifetime Payout, Last Month, Next Month, Pending Payout — see
 * lib/payout-monthly.ts for the exact rolling logic) and a full monthly
 * ledger table with real Organic/Referral/Promotion revenue columns
 * and a downloadable PDF statement per month (app/api/payout-report).
 */
export default async function PayoutSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  const isAffiliateToo = await hasAffiliateCapability(session.user.id);
  if (role !== "AUTHOR" && !isAffiliateToo) redirect("/account");

  const [monthlyRows, statCards] = await Promise.all([
    computeMonthlyPayoutRows(session.user.id),
    computePayoutStatCards(session.user.id),
  ]);

  let available = 0;
  let onHold = 0;
  let rolledOver = 0;
  if (role === "AUTHOR") {
    const authorWallet = await getMyWallet("author");
    available += authorWallet.available;
    onHold += authorWallet.onHold;
    rolledOver += authorWallet.rolledOver;
    if (isAffiliateToo) {
      const affiliateWallet = await getMyWallet("affiliate");
      available += affiliateWallet.available;
      onHold += affiliateWallet.onHold;
      rolledOver += affiliateWallet.rolledOver;
    }
  } else {
    const wallet = await getMyWallet("affiliate");
    available = wallet.available;
    onHold = wallet.onHold;
    rolledOver = wallet.rolledOver;
  }

  return (
    <DashboardShell role={role} activeKey="payout-settings" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 15.5 }}>Payouts</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Your payout schedule and history. To choose or change where your money is sent, go to Profile → Payment
            Details.
          </p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 28 }}>
        <div className="stat-card stat-card-referral">
          <div className="stat-label">Lifetime Payout</div>
          <div className="stat-value">${statCards.lifetimePayout.toFixed(2)}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card stat-card-promotion">
          <div className="stat-label">Last Month</div>
          <div className="stat-value">${statCards.lastMonth.toFixed(2)}</div>
          <div className="stat-sub">Paid by the 15th</div>
        </div>
        <div className="stat-card stat-card-total">
          <div className="stat-label">Next Month</div>
          <div className="stat-value">${statCards.liveTotal.toFixed(2)}</div>
          <div className="stat-sub">{LIVE_LABEL}, still growing</div>
        </div>
        <div className="stat-card stat-card-due">
          <div className="stat-label">{statCards.pendingStatus === "Paid" ? "Paid This Month" : statCards.pendingPayout < MIN_PAYOUT_AMOUNT ? ROLLED_LABEL : PENDING_LABEL}</div>
          <div className="stat-value">${statCards.pendingPayout.toFixed(2)}</div>
          <div className="stat-sub">
            {statCards.pendingStatus === "Paid"
              ? "Paid by the 15th"
              : statCards.pendingPayout < MIN_PAYOUT_AMOUNT
                ? `Under $${MIN_PAYOUT_AMOUNT}, rolls into the next cycle`
                : "Confirmed — released by the 15th"}
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: 16, margin: "0 0 14px" }}>Your payout schedule</h3>
      <AutoPayoutInfo available={available} onHold={onHold} rolledOver={rolledOver} hasRecipient={true} />

      <h3 style={{ fontSize: 16, margin: "28px 0 14px" }}>Monthly Payout History</h3>
      <div className="map-card" style={{ padding: 20 }}>
        {/* Table/headers always render, even with no history yet — the
            empty state is a single full-width row inside <tbody>, not a
            replacement for the whole table (same pattern used for the
            admin Payouts ledger and Blog Moderation tables). The current
            month's row is "Live" and its figures are computed fresh from
            real sale data on every load (see lib/payout-monthly.ts) — the
            LiveRefresher below re-runs that fetch on an interval so the
            Amount/Referral/Promotion figures for the Live row keep
            climbing in place while the page is left open, not just on a
            manual reload. */}
        <LiveRefresher intervalMs={15000} />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={TABLE_HEAD_STYLE}>Month<ColHelp text="The calendar month this row's earnings were made in." /></th>
                <th style={TABLE_HEAD_STYLE}>Units<ColHelp text="How many copies of your own books were sold this month." /></th>
                <th style={TABLE_HEAD_STYLE}>Royalties<ColHelp text="Your share of the sales of your own books this month." /></th>
                <th style={TABLE_HEAD_STYLE}>Referral<ColHelp text="A percentage of company revenue from authors you personally referred onto the platform, earned this month." /></th>
                <th style={TABLE_HEAD_STYLE}>Promotion<ColHelp text="Commission earned this month from copies sold through your own affiliate promotional links." /></th>
                <th style={TABLE_HEAD_STYLE}>Payout Date<ColHelp text="Once this month's earnings are confirmed and the total due has reached the $30 minimum, they're released by the 15th of the following month." /></th>
                <th style={TABLE_HEAD_STYLE}>Status<ColHelp text={STATUS_COLUMN_HELP} /></th>
                <th style={TABLE_HEAD_STYLE}>Amount<ColHelp text="Your total earnings for the month: royalties plus referral and promotion commissions combined. On the Live row this also includes any balance rolled over from earlier months, which keep their own Rolled rows below." /></th>
                <th style={TABLE_HEAD_STYLE}>Report<ColHelp text="Download this month's full payout statement as a PDF, itemized the same way as your account's statements are always formatted." /></th>
              </tr>
            </thead>
            <tbody>
              {monthlyRows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: "24px 16px", color: "var(--ink-faint)", fontSize: 13, textAlign: "center" }}>
                    No earnings yet.
                  </td>
                </tr>
              ) : (
                monthlyRows.map((r) => (
                  <tr key={r.monthKey}>
                    <td style={TABLE_CELL_STYLE}>{r.monthLabel}</td>
                    <td style={TABLE_CELL_STYLE}>{r.unitsSold}</td>
                    <td style={TABLE_CELL_STYLE}>${r.organicRevenue.toFixed(2)}</td>
                    <td style={TABLE_CELL_STYLE}>${r.referralRevenue.toFixed(2)}</td>
                    <td style={TABLE_CELL_STYLE}>${r.promotionRevenue.toFixed(2)}</td>
                    <td style={TABLE_CELL_STYLE}>{r.payoutDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td style={TABLE_CELL_STYLE}>
                      <span className="age-pill" style={authorStatusPillStyle(r.status)} title={authorStatusHelp(r.status)}>
                        {authorStatusLabel(r.status)}
                      </span>
                    </td>
                    <td style={TABLE_CELL_STYLE}>
                      ${(r.status === "Live" && r.liveTotal !== undefined ? r.liveTotal : r.amount).toFixed(2)}
                    </td>
                    <td style={TABLE_CELL_STYLE}>
                      <a
                        className="btn btn-ghost btn-small"
                        href={`/api/payout-report?month=${r.monthKey}`}
                        title={`Download the ${r.monthLabel} statement as a PDF`}
                      >
                        ↓
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}
