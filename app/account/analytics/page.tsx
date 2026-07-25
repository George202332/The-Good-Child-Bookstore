import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { getAuthorAnalytics } from "@/actions/author-analytics";

export default async function AuthorAnalyticsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "AUTHOR") redirect("/account");

  const data = await getAuthorAnalytics();
  const maxMonthly = Math.max(1, ...data.monthlyRevenue.map((m) => m.amount));

  return (
    <DashboardShell role="AUTHOR" activeKey="analytics" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Analytics</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>How your books are performing.</p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total sales</div>
          <div className="stat-value">{data.totalSales}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total revenue</div>
          <div className="stat-value">${data.totalRevenue.toFixed(2)}</div>
          <div className="stat-sub">Your share, all time</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Downloads</div>
          <div className="stat-value">{data.totalDownloads}</div>
          <div className="stat-sub">Across all devices</div>
        </div>
      </div>

      <h3 style={{ fontSize: 16, marginBottom: 14 }}>Revenue by month</h3>
      {data.monthlyRevenue.length === 0 ? (
        <div className="map-card" style={{ padding: "20px 16px", color: "var(--ink-faint)", fontSize: 13, textAlign: "center", marginBottom: 24 }}>
          No sales recorded yet — this chart fills in once your books start selling.
        </div>
      ) : (
        <div className="map-card" style={{ padding: "16px 16px", display: "flex", alignItems: "flex-end", gap: 10, height: 160, marginBottom: 24 }}>
          {data.monthlyRevenue.map((m) => (
            <div key={m.month} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
              <div title={`$${m.amount.toFixed(2)}`} style={{ width: "100%", background: "var(--coral)", borderRadius: "4px 4px 0 0", height: `${Math.max(4, (m.amount / maxMonthly) * 110)}px` }} />
              <div style={{ fontSize: 10, color: "var(--ink-faint)", marginTop: 6 }}>{m.month}</div>
            </div>
          ))}
        </div>
      )}

      <h3 style={{ fontSize: 16, marginBottom: 14 }}>Top books</h3>
      <div className="map-card" style={{ padding: "6px 16px" }}>
        {data.topBooks.length === 0 ? (
          <div style={{ padding: "20px 0", color: "var(--ink-faint)", fontSize: 13, textAlign: "center" }}>No sales recorded yet.</div>
        ) : (
          data.topBooks.map((b) => (
            <div key={b.title} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>{b.title}</span>
              <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>{b.unitsSold} sold · ${b.revenue.toFixed(2)}</span>
            </div>
          ))
        )}
      </div>
    </DashboardShell>
  );
}
