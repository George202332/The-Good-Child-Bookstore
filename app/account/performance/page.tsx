import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { getMyLinkPerformance } from "@/actions/affiliate-performance";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";

export default async function PerformancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "AFFILIATE" && !(await hasAffiliateCapability(session.user.id))) redirect("/account");

  const rows = await getMyLinkPerformance();
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const totalConversions = rows.reduce((s, r) => s + r.conversions, 0);
  const conversionRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : "0.0";

  return (
    <DashboardShell role={role} activeKey="performance" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Performance</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Clicks, conversions, and commission by link.</p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-label">Total clicks</div><div className="stat-value">{totalClicks}</div><div className="stat-sub">All links</div></div>
        <div className="stat-card"><div className="stat-label">Conversions</div><div className="stat-value">{totalConversions}</div><div className="stat-sub">Sales referred</div></div>
        <div className="stat-card"><div className="stat-label">Conversion rate</div><div className="stat-value">{conversionRate}%</div><div className="stat-sub">Conversions ÷ clicks</div></div>
      </div>

      <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              {["Link code", "Book", "Clicks", "Conversions", "Commission"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11.5, textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: "24px 16px", color: "var(--ink-faint)", fontSize: 13, textAlign: "center" }}>No links yet — generate one from Referral Links.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", fontFamily: "monospace", fontSize: 12 }}>{r.code}</td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{r.bookTitle ?? "—"}</td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{r.clicks}</td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{r.conversions}</td>
                  <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", fontWeight: 700 }}>${r.commission.toFixed(2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </DashboardShell>
  );
}
