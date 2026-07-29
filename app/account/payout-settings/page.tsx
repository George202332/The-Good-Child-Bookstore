import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { AutoPayoutInfo } from "@/components/AutoPayoutInfo";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";
import { computeMonthlyPayoutRows, computePayoutStatCards } from "@/lib/payout-monthly";
import { getMyWallet } from "@/actions/wallet";
import { ColHelp } from "@/components/ColHelp";
import { MIN_PAYOUT_AMOUNT } from "@/lib/payout-threshold";

const TABLE_HEAD_STYLE: React.CSSProperties = { padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap" };
const TABLE_CELL_STYLE: React.CSSProperties = { padding: "10px 16px", borderBottom: "1px solid var(--line)" };

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
  if (role !== "AUTHOR" && role !== "AFFILIATE" && !isAffiliateToo) redirect("/account");

  const [monthlyRows, statCards] = await Promise.all([
    computeMonthlyPayoutRows(session.user.id),
    computePayoutStatCards(session.user.id),
  ]);

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
          <div className="stat-sub">Paid on the 15th</div>
        </div>
        <div className="stat-card stat-card-total">
          <div className="stat-label">Next Month</div>
          <div className="stat-value">${statCards.nextMonth.toFixed(2)}</div>
          <div className="stat-sub">Still growing</div>
        </div>
        <div className="stat-card stat-card-due">
          <div className="stat-label">{statCards.pendingStatus === "Paid" ? "Paid This Month" : "Pending Payout"}</div>
          <div className="stat-value">${statCards.pendingPayout.toFixed(2)}</div>
          <div className="stat-sub">
            {statCards.pendingStatus === "Paid"
              ? "Paid on the 15th"
              : statCards.pendingPayout < MIN_PAYOUT_AMOUNT
                ? `Held, under $${MIN_PAYOUT_AMOUNT}`
                : "Due the 15th"}
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: 16, margin: "0 0 14px" }}>Your payout schedule</h3>
      <AutoPayoutInfo available={available} onHold={onHold} nextReleaseDate={nextReleaseDate} hasRecipient={true} />

      <h3 style={{ fontSize: 16, margin: "28px 0 14px" }}>Monthly payout history</h3>
      <div className="map-card" style={{ padding: 20 }}>
        {monthlyRows.length === 0 ? (
          <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>No earnings yet.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={TABLE_HEAD_STYLE}>Month<ColHelp text="The calendar month this row's earnings were made in." /></th>
                  <th style={TABLE_HEAD_STYLE}>Amount<ColHelp text="Your total earnings for the month: organic book sales plus referral and promotion commissions combined." /></th>
                  <th style={TABLE_HEAD_STYLE}>Units Sold<ColHelp text="How many copies of your own books were sold this month." /></th>
                  <th style={TABLE_HEAD_STYLE}>Organic Revenue<ColHelp text="Your share of book sales this month, whether the reader found the book directly or arrived via an affiliate link." /></th>
                  <th style={TABLE_HEAD_STYLE}>Referral Revenue<ColHelp text="A percentage of company revenue from authors you personally referred onto the platform, earned this month." /></th>
                  <th style={TABLE_HEAD_STYLE}>Promotion Revenue<ColHelp text="Commission earned this month from copies sold through your own affiliate promotional links." /></th>
                  <th style={TABLE_HEAD_STYLE}>Payout Date<ColHelp text="This month's earnings become payable on the 15th of the following month, as long as the total due has reached the $30 minimum." /></th>
                  <th style={TABLE_HEAD_STYLE}>Status<ColHelp text="Pending payout means the 15th hasn't been processed yet. Paid means the transfer for this month has gone out." /></th>
                  <th style={TABLE_HEAD_STYLE}>Report<ColHelp text="Download this month's full payout statement as a PDF, itemized the same way as your account's statements are always formatted." /></th>
                </tr>
              </thead>
              <tbody>
                {monthlyRows.map((r) => (
                  <tr key={r.monthKey}>
                    <td style={TABLE_CELL_STYLE}>{r.monthLabel}</td>
                    <td style={TABLE_CELL_STYLE}>${r.amount.toFixed(2)}</td>
                    <td style={TABLE_CELL_STYLE}>{r.unitsSold}</td>
                    <td style={TABLE_CELL_STYLE}>${r.organicRevenue.toFixed(2)}</td>
                    <td style={TABLE_CELL_STYLE}>${r.referralRevenue.toFixed(2)}</td>
                    <td style={TABLE_CELL_STYLE}>${r.promotionRevenue.toFixed(2)}</td>
                    <td style={TABLE_CELL_STYLE}>{r.payoutDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                    <td style={TABLE_CELL_STYLE}>
                      <span className="age-pill">
                        {r.status === "Paid" ? "Paid" : r.amount < MIN_PAYOUT_AMOUNT ? `Held (below $${MIN_PAYOUT_AMOUNT})` : "Pending payout"}
                      </span>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
