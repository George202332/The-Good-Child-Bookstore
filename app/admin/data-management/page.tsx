import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { getTestDataSummary, getTestDataAuditLog, getSiteDataMode } from "@/actions/test-data";
import { TestDataControls } from "./TestDataControls";
import { SiteModeToggle } from "./SiteModeToggle";

export const dynamic = "force-dynamic";

export default async function DataManagementPage() {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const [summary, auditLog, siteMode] = await Promise.all([getTestDataSummary(), getTestDataAuditLog(), getSiteDataMode()]);
  if ("error" in summary) redirect("/admin");

  return (
    <AdminShell role="ADMIN" activeKey="data-management" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <h2 style={{ fontSize: 20 }}>Data Management</h2>
          <SiteModeToggle currentMode={siteMode} />
        </div>
        <p style={{ color: "var(--admin-text-faint)", fontSize: 13.5, marginTop: 2 }}>
          The site is currently in <strong>{siteMode === "test" ? "Test" : "Live"}</strong> mode — every new account, book, and
          order created right now is automatically flagged as {siteMode === "test" ? "test data" : "real/live"}, until this is
          switched.
        </p>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Test accounts</div>
          <div className="stat-value">{summary.testAccounts}</div>
          <div className="stat-sub">{summary.liveAccounts} live</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Test books</div>
          <div className="stat-value">{summary.testBooks}</div>
          <div className="stat-sub">{summary.liveBooks} live</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Test orders</div>
          <div className="stat-value">{summary.testOrders}</div>
          <div className="stat-sub">{summary.liveOrders} live</div>
        </div>
      </div>

      <TestDataControls summary={summary} />

      <div className="map-card" style={{ padding: 20, marginTop: 20 }}>
        <h3 style={{ fontSize: 15, marginBottom: 10 }}>Deletion audit log</h3>
        {"error" in auditLog || auditLog.length === 0 ? (
          <p className="field-hint" style={{ margin: 0 }}>No test-data deletions have been recorded yet.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--line)", textAlign: "left", fontSize: 11, textTransform: "uppercase", color: "var(--admin-text-faint)" }}>When</th>
                  <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--line)", textAlign: "left", fontSize: 11, textTransform: "uppercase", color: "var(--admin-text-faint)" }}>Who</th>
                  <th style={{ padding: "8px 12px", borderBottom: "1px solid var(--line)", textAlign: "left", fontSize: 11, textTransform: "uppercase", color: "var(--admin-text-faint)" }}>Deleted</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.map((e) => {
                  const m = e.metadata as { accounts?: number; books?: number; orders?: number } | null;
                  return (
                    <tr key={e.id}>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--line)" }}>{e.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--line)" }}>{e.actorName} ({e.actorEmail})</td>
                      <td style={{ padding: "8px 12px", borderBottom: "1px solid var(--line)" }}>{m?.accounts ?? 0} account(s), {m?.books ?? 0} book(s), {m?.orders ?? 0} order(s)</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
