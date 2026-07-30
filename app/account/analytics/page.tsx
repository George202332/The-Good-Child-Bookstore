import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { getAuthorAnalytics } from "@/actions/author-analytics";
import { getAuthorBooksTable } from "@/actions/author-books-table";
import { BarChart } from "@/components/charts/BarChart";
import { PieChart } from "@/components/charts/PieChart";
import { WorldMap } from "@/components/charts/WorldMap";
import { ColHelp } from "@/components/ColHelp";

const FORMAT_COLORS: Record<string, string> = { eBook: "#2451B7", Paperback: "#B7472A", Hardcover: "#1F6B48", Audiobook: "#8A5A0B", Unspecified: "#9A93A8" };
const SALE_TYPE_COLORS: Record<string, string> = { "Organic": "#2451B7", "Via affiliate link": "#B7472A" };
const REGION_COLORS = ["#2451B7", "#B7472A", "#1F6B48", "#8A5A0B", "#7A5FB5"];

const TABLE_HEAD_STYLE: React.CSSProperties = { padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11, textTransform: "uppercase", textAlign: "left", whiteSpace: "nowrap" };
const TABLE_CELL_STYLE: React.CSSProperties = { padding: "10px 16px", borderBottom: "1px solid var(--line)" };

/**
 * Sales — pure-numbers analytics (sale counts, format/channel/region
 * breakdowns), deliberately never showing currency; revenue and
 * earnings have their own real home on the Revenue page.
 */
export default async function AuthorAnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AUTHOR") redirect("/account");

  const [data, booksTable] = await Promise.all([getAuthorAnalytics(), getAuthorBooksTable()]);

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
          <div className="stat-label">Active Titles</div>
          <div className="stat-value">{data.activeTitles}</div>
          <div className="stat-sub">Currently published</div>
        </div>
        <div className="stat-card stat-card-total">
          <div className="stat-label">Countries Reached</div>
          <div className="stat-value">{data.countriesReached}</div>
          <div className="stat-sub">Distinct buyer countries</div>
        </div>
        <div className="stat-card stat-card-due">
          <div className="stat-label">This Month&apos;s Sales</div>
          <div className="stat-value">{data.monthSalesCount}</div>
          <div className="stat-sub">Organic + affiliate</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div className="map-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 16 }}>Sales by month: {new Date().getFullYear()}</h3>
          <BarChart data={data.monthlySales.map((m) => ({ label: m.month, value: m.units }))} color="#2451B7" />
        </div>
        <div className="map-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 16 }}>Sales by format</h3>
          <PieChart data={data.formatBreakdown.map((f) => ({ label: f.format, value: f.count, color: FORMAT_COLORS[f.format] ?? "#9A93A8" }))} legendOffset="0.5in" />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>
        <div className="map-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 16 }}>Top regions</h3>
          {data.topCountriesWithPct.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--ink-faint)" }}>No sales recorded yet.</p>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.topCountriesWithPct.map((c, i) => (
                  <div key={c.country} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: REGION_COLORS[i], display: "inline-block" }} />
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{c.country}: {c.count} {c.count === 1 ? "copy" : "copies"}</span>
                  </div>
                ))}
              </div>
              <PieChart
                size={140}
                data={data.topCountriesWithPct.map((c, i) => ({ label: c.country, value: c.count, color: REGION_COLORS[i] }))}
              />
            </div>
          )}
        </div>
        <div className="map-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, marginBottom: 16 }}>Organic vs affiliate</h3>
          <PieChart data={data.saleTypeBreakdown.map((s) => ({ label: s.type, value: s.count, color: SALE_TYPE_COLORS[s.type] ?? "#9A93A8" }))} />
        </div>
      </div>

      <div className="map-card" style={{ padding: 20, marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, marginBottom: 16 }}>Sales Distribution</h3>
        <div style={{ height: 440 }}>
          <WorldMap highlightedCountryCodes={new Set(data.geoCountryCodes)} />
        </div>
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 14 }}>All books</h3>
      <div className="map-card" style={{ padding: 0, marginBottom: 24 }}>
        <div className="no-scrollbar" style={{ maxHeight: 520, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead style={{ position: "sticky", top: 0, background: "var(--paper)", zIndex: 1 }}>
              <tr>
                <th style={TABLE_HEAD_STYLE}>SN<ColHelp text="Row number." /></th>
                <th style={TABLE_HEAD_STYLE}>Title<ColHelp text="The book's title." /></th>
                <th style={TABLE_HEAD_STYLE}>Author<ColHelp text="The name shown as the author on the book — your pen name if you've set one, otherwise your account name." /></th>
                <th style={TABLE_HEAD_STYLE}>Category<ColHelp text="The book's primary category." /></th>
                <th style={TABLE_HEAD_STYLE}>eBook<ColHelp text="Copies sold in eBook format." /></th>
                <th style={TABLE_HEAD_STYLE}>Audio<ColHelp text="Copies sold in Audiobook format." /></th>
                <th style={TABLE_HEAD_STYLE}>Paperback<ColHelp text="Copies sold in Paperback format." /></th>
                <th style={TABLE_HEAD_STYLE}>Hardcover<ColHelp text="Copies sold in Hardcover format." /></th>
                <th style={TABLE_HEAD_STYLE}>Copies<ColHelp text="Total copies sold across every format combined." /></th>
              </tr>
            </thead>
            <tbody>
              {booksTable.length === 0 ? (
                <tr><td style={TABLE_CELL_STYLE} colSpan={10}>No books yet.</td></tr>
              ) : (
                booksTable.map((b, i) => (
                  <tr key={b.title + i}>
                    <td style={TABLE_CELL_STYLE}>{i + 1}</td>
                    <td style={TABLE_CELL_STYLE}>{b.title}</td>
                    <td style={TABLE_CELL_STYLE}>{b.authorDisplayName}</td>
                    <td style={TABLE_CELL_STYLE}>{b.category}</td>
                    <td style={TABLE_CELL_STYLE}>{b.ebook}</td>
                    <td style={TABLE_CELL_STYLE}>{b.audiobook}</td>
                    <td style={TABLE_CELL_STYLE}>{b.paperback}</td>
                    <td style={TABLE_CELL_STYLE}>{b.hardcover}</td>
                    <td style={TABLE_CELL_STYLE}><strong>{b.copies}</strong></td>
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
