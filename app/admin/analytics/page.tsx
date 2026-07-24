import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminShell } from "@/components/AdminShell";
import { getAnalyticsSummary } from "@/actions/analytics";

/**
 * Analytics — the brief's Revenue/Orders/Books Sold/Top Books/Monthly
 * Growth requirements, built entirely from real SaleLine/Order data (see
 * actions/analytics.ts). No simulated charts. EDITOR sees volume metrics
 * only, per "Editor cannot access financial information".
 */
export default async function AnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "EDITOR") redirect("/account");

  const data = await getAnalyticsSummary();
  const maxMonthly = Math.max(1, ...data.monthlyRevenue.map((m) => m.amount));
  const maxTopBookSales = Math.max(1, ...data.topBooks.map((b) => b.unitsSold));

  return (
    <AdminShell role={role} activeKey="analytics" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Analytics</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Platform-wide sales performance.</p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Orders</div>
          <div className="stat-value">{data.totalOrders}</div>
          <div className="stat-sub">Paid, all time</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Books sold</div>
          <div className="stat-value">{data.totalBooksSold}</div>
          <div className="stat-sub">Units, all time</div>
        </div>
        {data.totalCompanyRevenue !== null && (
          <div className="stat-card">
            <div className="stat-label">Company revenue</div>
            <div className="stat-value">${data.totalCompanyRevenue.toFixed(2)}</div>
            <div className="stat-sub">25% share, all time</div>
          </div>
        )}
        {data.totalAuthorRevenue !== null && (
          <div className="stat-card">
            <div className="stat-label">Author payouts</div>
            <div className="stat-value">${data.totalAuthorRevenue.toFixed(2)}</div>
            <div className="stat-sub">All time</div>
          </div>
        )}
      </div>

      {data.monthlyRevenue.length > 0 && (
        <>
          <h3 style={{ fontSize: 16, margin: "24px 0 14px" }}>Monthly revenue (gross)</h3>
          <div className="map-card" style={{ padding: "16px 16px", display: "flex", alignItems: "flex-end", gap: 10, height: 160 }}>
            {data.monthlyRevenue.map((m) => (
              <div key={m.month} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                <div
                  title={`$${m.amount.toFixed(2)}`}
                  style={{
                    width: "100%",
                    background: "var(--coral)",
                    borderRadius: "4px 4px 0 0",
                    height: `${Math.max(4, (m.amount / maxMonthly) * 110)}px`,
                  }}
                />
                <div style={{ fontSize: 10, color: "var(--ink-faint)", marginTop: 6, whiteSpace: "nowrap" }}>{m.month}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {data.revenueBreakdown.length > 0 && (
        <>
          <h3 style={{ fontSize: 16, margin: "24px 0 14px" }}>Revenue breakdown by month</h3>
          <div className="map-card" style={{ padding: 0, overflowX: "auto", marginBottom: 24 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  {["Month", "Orders", "Books Sold", "Gross Revenue", "Company Share", "Author Share", "Affiliate Share"].map((h) => (
                    <th key={h} style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.revenueBreakdown.map((row) => (
                  <tr key={row.month}>
                    <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", fontWeight: 700, whiteSpace: "nowrap" }}>{row.month}</td>
                    <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{row.orders}</td>
                    <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{row.booksSold}</td>
                    <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>${row.grossRevenue.toFixed(2)}</td>
                    <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>${row.companyShare.toFixed(2)}</td>
                    <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>${row.authorShare.toFixed(2)}</td>
                    <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>${row.affiliateShare.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3 style={{ fontSize: 16, margin: "24px 0 14px" }}>Top books</h3>
      {data.topBooks.length === 0 ? (
        <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13 }}>No sales recorded yet.</div>
      ) : (
        <div className="map-card" style={{ padding: "6px 16px" }}>
          {data.topBooks.map((b) => (
            <div key={b.title} style={{ padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>{b.title}</span>
                <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>{b.unitsSold} sold</span>
              </div>
              <div style={{ background: "var(--line)", borderRadius: 4, height: 6 }}>
                <div style={{ width: `${(b.unitsSold / maxTopBookSales) * 100}%`, background: "var(--mint-deep)", height: 6, borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
