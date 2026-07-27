import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardShell } from "@/components/DashboardShell";
import { getMyLinkPerformance } from "@/actions/affiliate-performance";
import { getAffiliateEarningsSummary } from "@/actions/affiliate-earnings-summary";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";
import { AffiliateEarningsCards } from "./AffiliateEarningsCards";

export default async function PerformancePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "AFFILIATE" && !(await hasAffiliateCapability(session.user.id))) redirect("/account");

  const rows = await getMyLinkPerformance();
  const earningsSummary = await getAffiliateEarningsSummary();
  const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
  const totalConversions = rows.reduce((s, r) => s + r.conversions, 0);
  const conversionRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : "0.0";
  const topLinks = [...rows].sort((a, b) => b.clicks - a.clicks).slice(0, 8);
  const maxClicks = Math.max(1, ...topLinks.map((r) => r.clicks));

  return (
    <DashboardShell role={role} activeKey="performance" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 8 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Affiliate</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Your affiliate programme has two distinct earning categories: each tracked separately with its own
            link and commission structure.
          </p>
        </div>
      </div>

      <AffiliateEarningsCards initial={earningsSummary} />

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-label">Total clicks</div><div className="stat-value">{totalClicks}</div><div className="stat-sub">All links</div></div>
        <div className="stat-card"><div className="stat-label">Conversions</div><div className="stat-value">{totalConversions}</div><div className="stat-sub">Sales referred</div></div>
        <div className="stat-card"><div className="stat-label">Conversion rate</div><div className="stat-value">{conversionRate}%</div><div className="stat-sub">Conversions ÷ clicks</div></div>
      </div>

      {topLinks.length > 0 && (
        <div className="map-card" style={{ padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, marginBottom: 16 }}>Clicks by link</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topLinks.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 140, fontSize: 12, color: "var(--ink-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>{r.bookTitle ?? r.code}</div>
                <div style={{ flex: 1, background: "var(--line)", borderRadius: 4, height: 16, position: "relative" }}>
                  <div style={{ width: `${(r.clicks / maxClicks) * 100}%`, background: "#2451B7", height: "100%", borderRadius: 4, minWidth: r.clicks > 0 ? 4 : 0 }} />
                </div>
                <div style={{ width: 36, fontSize: 12, fontWeight: 700, textAlign: "right", flexShrink: 0 }}>{r.clicks}</div>
              </div>
            ))}
          </div>
        </div>
      )}

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
              <tr><td colSpan={5} style={{ padding: "24px 16px", color: "var(--ink-faint)", fontSize: 13, textAlign: "center" }}>No links yet; generate one from Referral Links.</td></tr>
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
