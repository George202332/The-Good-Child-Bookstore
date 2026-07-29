import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { getAuthorAnalytics } from "@/actions/author-analytics";
import { BarChart } from "@/components/charts/BarChart";
import { PieChart } from "@/components/charts/PieChart";

const FORMAT_COLORS: Record<string, string> = { eBook: "#2451B7", Paperback: "#B7472A", Hardcover: "#1F6B48", Audiobook: "#8A5A0B", Unspecified: "#9A93A8" };
const SALE_TYPE_COLORS: Record<string, string> = { "Organic": "#2451B7", "Via affiliate link": "#B7472A" };

/**
 * Sales — pure-numbers analytics (sale counts, format/channel/region
 * breakdowns), deliberately never showing currency; revenue and
 * earnings have their own real home on the Revenue page.
 */
export default async function AuthorAnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AUTHOR") redirect("/account");

  const data = await getAuthorAnalytics();

  return (
    <DashboardShell role="AUTHOR" activeKey="analytics" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Sales</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            How your books are performing — pure numbers, not revenue. Your earnings live on the Revenue page.
          </p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card stat-card-referral">
          <div className="stat-label">Total Sales</div>
          <div className="stat-value">{data.totalSales}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card stat-card-promotion">
          <div className="stat-label">Downloads</div>
          <div className="stat-value">{data.totalDownloads}</div>
          <div className="stat-sub">Across all devices</div>
        </div>
        <div className="stat-card stat-card-total">
          <div className="stat-label">Countries Reached</div>
          <div className="stat-value">{data.countriesReached}</div>
          <div className="stat-sub">Distinct buyer countries</div>
        </div>
        <div className="stat-card stat-card-due">
          <div className="stat-label">Active Titles</div>
          <div className="stat-value">{data.activeTitles}</div>
          <div className="stat-sub">Currently published</div>
        </div>
      </div>

      <div className="map-card" style={{ padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, marginBottom: 16 }}>Sales by month</h3>
        <BarChart data={data.monthlySales.map((m) => ({ label: m.month, value: m.units }))} color="#2451B7" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div className="map-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 16 }}>Sales by format</h3>
          <PieChart data={data.formatBreakdown.map((f) => ({ label: f.format, value: f.count, color: FORMAT_COLORS[f.format] ?? "#9A93A8" }))} />
        </div>
        <div className="map-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 16 }}>Organic vs affiliate</h3>
          <PieChart data={data.saleTypeBreakdown.map((s) => ({ label: s.type, value: s.count, color: SALE_TYPE_COLORS[s.type] ?? "#9A93A8" }))} />
        </div>
      </div>

      <div className="map-card" style={{ padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, marginBottom: 16 }}>Top regions</h3>
        <BarChart data={data.topCountries.map((c) => ({ label: c.country, value: c.count }))} color="#1F6B48" />
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 14 }}>Top books</h3>
      <div className="map-card" style={{ padding: "6px 16px" }}>
        {data.topBooks.length === 0 ? (
          <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13, textAlign: "center" }}>No sales recorded yet.</div>
        ) : (
          data.topBooks.map((b) => (
            <div key={b.title} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>{b.title}</span>
              <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>{b.unitsSold} sold</span>
            </div>
          ))
        )}
      </div>
    </DashboardShell>
  );
}
