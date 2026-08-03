import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";
import { getAffiliateAnalytics } from "@/actions/affiliate-analytics-data";
import { PieChart } from "@/components/charts/PieChart";
import { WorldMap } from "@/components/charts/WorldMap";
import { ColHelp } from "@/components/ColHelp";

const REGION_COLORS = ["#2451B7", "#B7472A", "#1F6B48", "#8A5A0B", "#7A5FB5", "#C6437E", "#3F8F8A", "#9A93A8"];
const TABLE_HEAD_STYLE: React.CSSProperties = { padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11.5, textTransform: "uppercase", textAlign: "left" };
const TABLE_CELL_STYLE: React.CSSProperties = { padding: "10px 16px", borderBottom: "1px solid var(--line)" };

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
  const maxMonthlyClicks = Math.max(1, ...data.monthlyClicks.map((m) => m.clicks));
  const countryCodes = new Set(data.countryBreakdown.map((c) => c.country).filter((c) => c !== "Unknown"));

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

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20, marginBottom: 24, alignItems: "start" }}>
        <div className="map-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 4 }}>Clicks per month</h3>
          <p className="field-hint" style={{ margin: "0 0 14px" }}>January through December, {new Date().getFullYear()}.</p>
          <div>
            {data.monthlyClicks.map((m) => (
              <div key={m.month} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ width: 34, fontSize: 12, color: "var(--ink-faint)", flexShrink: 0 }}>{m.month}</span>
                <div style={{ flex: 1, background: "var(--cream)", borderRadius: 6, overflow: "hidden", height: 16 }}>
                  <div style={{ width: `${(m.clicks / maxMonthlyClicks) * 100}%`, background: "#2451B7", height: "100%", borderRadius: 6 }} />
                </div>
                <span style={{ width: 30, fontSize: 12, fontWeight: 700, textAlign: "right", flexShrink: 0 }}>{m.clicks}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="map-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 16 }}>Clicks by region</h3>
          {data.countryBreakdown.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-faint)" }}>No clicks yet.</p>
          ) : (
            <PieChart data={data.countryBreakdown.map((c, i) => ({ label: c.country, value: c.clicks, color: REGION_COLORS[i % REGION_COLORS.length] }))} />
          )}
        </div>
      </div>

      <div className="map-card" style={{ padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, marginBottom: 4 }}>Where your clicks come from</h3>
        <p className="field-hint" style={{ margin: "0 0 14px" }}>Countries highlighted below have at least one click on one of your links.</p>
        <div style={{ height: 280 }}>
          <WorldMap highlightedCountryCodes={countryCodes} />
        </div>
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 14 }}>Link performance</h3>
      <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={TABLE_HEAD_STYLE}>Book</th>
              <th style={TABLE_HEAD_STYLE}>Author</th>
              <th style={TABLE_HEAD_STYLE}>Clicks<ColHelp text="How many times this book's promotional link has been clicked, all time." /></th>
              <th style={TABLE_HEAD_STYLE}>Conversions<ColHelp text="How many of those clicks turned into an actual sale." /></th>
              <th style={TABLE_HEAD_STYLE}>Conversion Rate<ColHelp text="Conversions divided by clicks — how effectively this link turns visits into sales." /></th>
            </tr>
          </thead>
          <tbody>
            {data.linkBreakdown.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: "24px 16px", color: "var(--ink-faint)", fontSize: 13, textAlign: "center" }}>No links yet — generate one from Promotions to start tracking performance here.</td></tr>
            ) : (
              data.linkBreakdown.map((l, i) => (
                <tr key={i}>
                  <td style={TABLE_CELL_STYLE}><strong>{l.book}</strong></td>
                  <td style={TABLE_CELL_STYLE}>{l.author}</td>
                  <td style={TABLE_CELL_STYLE}>{l.clicks}</td>
                  <td style={TABLE_CELL_STYLE}>{l.conversions}</td>
                  <td style={TABLE_CELL_STYLE}>{l.conversionRate}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
