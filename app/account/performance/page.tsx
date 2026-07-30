import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";
import { getAffiliateAnalytics } from "@/actions/affiliate-analytics-data";
import { BarChart } from "@/components/charts/BarChart";
import { PieChart } from "@/components/charts/PieChart";

const REGION_COLORS = ["#2451B7", "#B7472A", "#1F6B48", "#8A5A0B", "#7A5FB5", "#C6437E", "#3F8F8A", "#9A93A8"];

/**
 * Affiliate — pure-numbers analytics (clicks, conversions, regions),
 * matching the Sales analytics page's convention: never shows currency.
 * Commission and revenue already have a real home on Referrals and
 * Revenue — this page is strictly about counts and where clicks come
 * from.
 */
export default async function PerformancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (!(await hasAffiliateCapability(session.user.id))) redirect("/account");

  const data = await getAffiliateAnalytics();

  return (
    <DashboardShell role={role} activeKey="performance" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Affiliate</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            How your promotional links are performing — pure numbers, not revenue. Your commission lives on the
            Referrals and Promotions pages.
          </p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card stat-card-referral">
          <div className="stat-label">Total Clicks</div>
          <div className="stat-value">{data.totalClicks}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card stat-card-promotion">
          <div className="stat-label">Conversions</div>
          <div className="stat-value">{data.totalConversions}</div>
          <div className="stat-sub">Sales referred</div>
        </div>
        <div className="stat-card stat-card-total">
          <div className="stat-label">Conversion Rate</div>
          <div className="stat-value">{data.conversionRate}%</div>
          <div className="stat-sub">Conversions ÷ clicks</div>
        </div>
        <div className="stat-card stat-card-due">
          <div className="stat-label">Countries Reached</div>
          <div className="stat-value">{data.countriesReached}</div>
          <div className="stat-sub">Distinct click locations</div>
        </div>
      </div>

      <div className="map-card" style={{ padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, marginBottom: 16 }}>Clicks by month</h3>
        <BarChart data={data.monthlyClicks.map((m) => ({ label: m.month, value: m.clicks }))} color="#2451B7" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div className="map-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 16 }}>Clicks by region</h3>
          <PieChart data={data.countryBreakdown.map((c, i) => ({ label: c.country, value: c.clicks, color: REGION_COLORS[i % REGION_COLORS.length] }))} />
        </div>
        <div className="map-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 16 }}>Top links by clicks</h3>
          <BarChart data={data.linkBreakdown.map((l) => ({ label: l.label, value: l.clicks }))} color="#B7472A" />
        </div>
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 14 }}>Link performance</h3>
      <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              {["Book", "Clicks", "Conversions"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11.5, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.linkBreakdown.length === 0 ? (
              <tr><td colSpan={3} style={{ padding: "24px 16px", color: "var(--ink-faint)", fontSize: 13, textAlign: "center" }}>No links yet; generate one from Promotions.</td></tr>
            ) : (
              data.linkBreakdown.map((l) => (
                <tr key={l.label}>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{l.label}</td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{l.clicks}</td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{l.conversions}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
