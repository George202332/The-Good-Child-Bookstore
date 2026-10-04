import Link from "next/link";
import { ColHelp } from "@/components/ColHelp";
import type { Role } from "@/lib/roles";
import { canViewFinancials } from "@/lib/roles";
import type { TransactionRow } from "@/actions/transactions";

/**
 * The actual dashboard-overview body — split out of app/admin/page.tsx
 * (Amendment 12) so app/investor/page.tsx can render the EXACT same
 * markup, not a re-approximation of it, while still linking to its own
 * /investor/transactions instead of /admin/transactions. Everything
 * here is identical to what Admin/Editor/Accountant see; the only
 * difference the Investor role gets is which Shell wraps it and where
 * "View all" points.
 */
export function DashboardOverview({
  role,
  heading,
  userCount,
  statusCount,
  roleCount,
  pendingBooks,
  pendingBlogs,
  pendingPayouts,
  totalOrders,
  companyRevenue,
  authorRevenue,
  affiliateRevenue,
  recentTransactions,
  transactionsHref,
}: {
  role: Role;
  heading: string;
  userCount: number;
  statusCount: (status: string) => number;
  roleCount: (r: string) => number;
  pendingBooks: number;
  pendingBlogs: number;
  pendingPayouts: number;
  totalOrders: number;
  companyRevenue: number;
  authorRevenue: number;
  affiliateRevenue: number;
  recentTransactions: TransactionRow[];
  transactionsHref: string;
}) {
  return (
    <>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>{heading}</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Platform-wide overview — real accounts, books, and transactions.
          </p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total users</div>
          <div className="stat-value">{userCount}</div>
          <div className="stat-sub">All roles</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Published books</div>
          <div className="stat-value">{statusCount("PUBLISHED")}</div>
          <div className="stat-sub">Live on the shelf</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Needs attention</div>
          <div className="stat-value">{pendingBooks + pendingBlogs + pendingPayouts}</div>
          <div className="stat-sub">Books, posts &amp; payouts pending</div>
        </div>
        {canViewFinancials(role) && (
          <div className="stat-card">
            <div className="stat-label">Total orders</div>
            <div className="stat-value">{totalOrders}</div>
            <div className="stat-sub">Paid, all time</div>
          </div>
        )}
      </div>

      {canViewFinancials(role) && (
        <>
          <h3 style={{ fontSize: 16, margin: "0 0 14px" }}>Who the money belongs to</h3>
          <div className="stat-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-label">Company revenue</div>
              <div className="stat-value">${companyRevenue.toFixed(2)}</div>
              <div className="stat-sub">30% share, all time</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Author payouts</div>
              <div className="stat-value">${authorRevenue.toFixed(2)}</div>
              <div className="stat-sub">All time</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Affiliate payouts</div>
              <div className="stat-value">${affiliateRevenue.toFixed(2)}</div>
              <div className="stat-sub">All time</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total</div>
              <div className="stat-value">${(companyRevenue + authorRevenue + affiliateRevenue).toFixed(2)}</div>
              <div className="stat-sub">Company + author + affiliate</div>
            </div>
          </div>
        </>
      )}

      <h3 style={{ fontSize: 16, margin: "0 0 14px" }}>Users by role</h3>
      <div className="map-card" style={{ padding: "6px 16px", marginBottom: 24 }}>
        {(["READER", "AUTHOR", "EDITOR", "CHIEF_EDITOR", "ADMIN", "ACCOUNTANT", "INVESTOR"] as const).map((r) => (
          <div key={r} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
            <span style={{ fontSize: 13.5 }}>{r.charAt(0) + r.slice(1).toLowerCase().replace("_", " ")}</span>
            <span style={{ fontWeight: 700 }}>{roleCount(r)}</span>
          </div>
        ))}
      </div>

      {canViewFinancials(role) && (
        <>
          <div className="section-head" style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 16 }}>Recent transactions</h3>
            <Link href={transactionsHref} className="see-all">View all →</Link>
          </div>
          <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  {[
                    { label: "Transaction ID", help: "A short reference for this row." },
                    { label: "Date", help: "When this sale or payout happened." },
                    { label: "Type", help: "Whether this row is a book Sale or a Payout." },
                    { label: "Party", help: "For a sale, the buyer. For a payout, who received it." },
                    { label: "Details", help: "The book and format sold, or the payout's earnings type." },
                    { label: "Amount", help: "The total amount of this sale, or the amount sent out for a payout." },
                    { label: "Company", help: "The company's share of this sale." },
                    { label: "Royalty", help: "The author's share (royalty) of this sale." },
                    { label: "Commission", help: "The affiliate's commission on this sale, if any." },
                  ].map((c) => (
                    <th key={c.label} style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
                      {c.label}<ColHelp text={c.help} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: "24px 16px", color: "var(--ink-faint, var(--admin-text-faint))", fontSize: 13, textAlign: "center" }}>
                      No transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentTransactions.map((r) => (
                    <tr key={`${r.type}-${r.id}`}>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", fontFamily: "monospace", fontSize: 12 }}>{r.id.slice(0, 8).toUpperCase()}</td>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>
                        {new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}><span className="age-pill">{r.type}</span></td>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{r.party}</td>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{r.detail}</td>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", fontWeight: 700 }}>
                        {r.type === "Payout" ? "-" : ""}${r.amount.toFixed(2)}
                      </td>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{r.companyShare !== null ? `$${r.companyShare.toFixed(2)}` : "—"}</td>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{r.authorShare !== null ? `$${r.authorShare.toFixed(2)}` : "—"}</td>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", color: r.affiliateShare ? "#1F6B48" : "var(--ink-faint)", fontWeight: r.affiliateShare ? 700 : 400 }}>
                        {r.affiliateShare !== null ? `$${r.affiliateShare.toFixed(2)}` : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
