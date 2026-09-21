import { redirect } from "next/navigation";
import Link from "next/link";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { getTestDataSummary, getTestDataAuditLog } from "@/actions/test-data";
import { TestDataControls } from "./TestDataControls";

export const dynamic = "force-dynamic";

export default async function DataManagementPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const { mode: modeParam } = await searchParams;
  const mode: "live" | "test" = modeParam === "test" ? "test" : "live";

  const [summary, auditLog] = await Promise.all([getTestDataSummary(), getTestDataAuditLog()]);
  if ("error" in summary) redirect("/admin");

  return (
    <AdminShell role="ADMIN" activeKey="data-management" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <h2 style={{ fontSize: 20 }}>Data Management</h2>
          <div style={{ display: "flex", gap: 6 }}>
            <Link href="/admin/data-management?mode=live" className={`btn btn-small ${mode === "live" ? "btn-primary" : "btn-ghost"}`}>Live</Link>
            <Link href="/admin/data-management?mode=test" className={`btn btn-small ${mode === "test" ? "btn-primary" : "btn-ghost"}`}>Test</Link>
          </div>
        </div>
        <p style={{ color: "var(--admin-text-faint)", fontSize: 13.5, marginTop: 2 }}>
          {mode === "test" ? "Showing what's currently flagged as test data." : "Showing real, live data only."}
        </p>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">{mode === "test" ? "Test accounts" : "Live accounts"}</div>
          <div className="stat-value">{mode === "test" ? summary.testAccounts : summary.liveAccounts}</div>
          <div className="stat-sub">{mode === "test" ? `${summary.liveAccounts} live` : `${summary.testAccounts} test`}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{mode === "test" ? "Test books" : "Live books"}</div>
          <div className="stat-value">{mode === "test" ? summary.testBooks : summary.liveBooks}</div>
          <div className="stat-sub">{mode === "test" ? `${summary.liveBooks} live` : `${summary.testBooks} test`}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{mode === "test" ? "Test orders" : "Live orders"}</div>
          <div className="stat-value">{mode === "test" ? summary.testOrders : summary.liveOrders}</div>
          <div className="stat-sub">{mode === "test" ? `${summary.liveOrders} live` : `${summary.testOrders} test`}</div>
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
