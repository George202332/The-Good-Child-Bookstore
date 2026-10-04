import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { InvestorShell } from "@/components/InvestorShell";
import { BarChart } from "@/components/charts/BarChart";
import { getInvestorOverview } from "@/lib/investor-metrics";

/**
 * Investor-only growth/retention overview (Amendment 12) — explicitly
 * NOT part of the admin backend; nothing here exists anywhere under
 * /admin. Three real charts (revenue growth, order-volume growth,
 * new-vs-active author/affiliate retention) built from
 * lib/investor-metrics.ts, plus a CSV export of the same numbers.
 */
export default async function InvestorOverviewPage() {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (role !== "INVESTOR" && role !== "ADMIN") redirect("/admin");

  const { growth, retention } = await getInvestorOverview();

  return (
    <InvestorShell activeKey="overview" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Growth Overview</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Revenue, order volume, and user growth over the last 12 months, plus author/affiliate retention —
            real platform data, not projections.
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page navigation */}
        <a className="btn btn-ghost btn-small" href="/api/investor/overview">Export CSV</a>
      </div>

      <h3 style={{ fontSize: 16, margin: "0 0 14px" }}>Revenue growth (gross, monthly)</h3>
      <div className="map-card" style={{ padding: 16, marginBottom: 24 }}>
        <BarChart data={growth.map((g) => ({ label: g.month, value: Math.round(g.revenue) }))} color="var(--coral)" valueSuffix="" />
      </div>

      <h3 style={{ fontSize: 16, margin: "0 0 14px" }}>Order volume growth (monthly)</h3>
      <div className="map-card" style={{ padding: 16, marginBottom: 24 }}>
        <BarChart data={growth.map((g) => ({ label: g.month, value: g.orders }))} color="var(--mint-deep)" />
      </div>

      <h3 style={{ fontSize: 16, margin: "0 0 14px" }}>New user signups (all roles, monthly)</h3>
      <div className="map-card" style={{ padding: 16, marginBottom: 24 }}>
        <BarChart data={growth.map((g) => ({ label: g.month, value: g.newUsers }))} color="var(--lavender-deep)" />
      </div>

      <h3 style={{ fontSize: 16, margin: "0 0 14px" }}>Author retention — new joins vs. active</h3>
      <p style={{ fontSize: 12.5, color: "var(--ink-faint)", margin: "-6px 0 10px" }}>
        &quot;Active&quot; means at least one real, paid sale that month — not simply being registered.
      </p>
      <div className="map-card" style={{ padding: 0, overflowX: "auto", marginBottom: 24 }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              {["Month", "New Authors", "Active Authors"].map((label) => (
                <th key={label} style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {retention.map((r) => (
              <tr key={r.month}>
                <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", fontWeight: 700, whiteSpace: "nowrap" }}>{r.month}</td>
                <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{r.newAuthors}</td>
                <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{r.activeAuthors}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 style={{ fontSize: 16, margin: "0 0 14px" }}>Affiliate retention — new joins vs. active</h3>
      <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              {["Month", "New Affiliates", "Active Affiliates"].map((label) => (
                <th key={label} style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {retention.map((r) => (
              <tr key={r.month}>
                <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", fontWeight: 700, whiteSpace: "nowrap" }}>{r.month}</td>
                <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{r.newAffiliates}</td>
                <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{r.activeAffiliates}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </InvestorShell>
  );
}
