import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminShell } from "@/components/AdminShell";
import { getTestDataSummary } from "@/actions/test-data";
import { TestDataControls } from "./TestDataControls";

export const dynamic = "force-dynamic";

export default async function DataManagementPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const summary = await getTestDataSummary();
  if ("error" in summary) redirect("/admin");

  return (
    <AdminShell role="ADMIN" activeKey="data-management" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Data Management</h2>
          <p style={{ color: "var(--admin-text-faint)", fontSize: 13.5, marginTop: 2 }}>
            Real counts of what&apos;s flagged as test vs. live data, and the tools to manage it.
          </p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card"><div className="stat-label">Test accounts</div><div className="stat-value">{summary.testAccounts}</div><div className="stat-sub">{summary.liveAccounts} live</div></div>
        <div className="stat-card"><div className="stat-label">Test books</div><div className="stat-value">{summary.testBooks}</div><div className="stat-sub">{summary.liveBooks} live</div></div>
        <div className="stat-card"><div className="stat-label">Test orders</div><div className="stat-value">{summary.testOrders}</div><div className="stat-sub">{summary.liveOrders} live</div></div>
      </div>

      <TestDataControls summary={summary} />
    </AdminShell>
  );
}
