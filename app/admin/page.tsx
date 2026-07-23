import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/AdminShell";
import { canViewFinancials } from "@/lib/roles";

/**
 * Admin/Editor dashboard overview — entirely new, no equivalent in the
 * original frontend. Financial totals are hidden for EDITOR per the
 * brief's explicit "Editor cannot access financial information" rule
 * (lib/roles.ts canViewFinancials()).
 */
export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "EDITOR") redirect("/account");

  const [userCount, bookCounts, pendingBooks] = await Promise.all([
    prisma.user.count(),
    prisma.book.groupBy({ by: ["status"], _count: { status: true } }),
    prisma.book.count({ where: { status: "PENDING_REVIEW" } }),
  ]);

  let companyRevenue = 0;
  if (canViewFinancials(role)) {
    const agg = await prisma.saleLine.aggregate({ _sum: { companyShare: true } });
    companyRevenue = Number(agg._sum.companyShare ?? 0);
  }

  const statusCount = (status: string) =>
    bookCounts.find((b: { status: string; _count: { status: number } }) => b.status === status)?._count.status ?? 0;

  return (
    <AdminShell role={role} activeKey="dashboard" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>{role === "ADMIN" ? "Admin" : "Editor"} dashboard</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Platform-wide overview.</p>
        </div>
      </div>
      <div className="stat-grid" style={{ marginBottom: 34 }}>
        <div className="stat-card">
          <div className="stat-label">Total users</div>
          <div className="stat-value">{userCount}</div>
          <div className="stat-sub">All roles</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Published books</div>
          <div className="stat-value">{statusCount("PUBLISHED")}</div>
          <div className="stat-sub">Live on the shelf</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Pending review</div>
          <div className="stat-value">{pendingBooks}</div>
          <div className="stat-sub">Needs editorial action</div>
        </div>
        {canViewFinancials(role) && (
          <div className="stat-card">
            <div className="stat-label">Company revenue</div>
            <div className="stat-value">${companyRevenue.toFixed(2)}</div>
            <div className="stat-sub">All time, 25% share</div>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
