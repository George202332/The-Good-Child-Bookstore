import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/AdminShell";
import { canViewFinancials } from "@/lib/roles";
import { getTransactionLedger } from "@/actions/transactions";

/**
 * Admin/Editor dashboard overview — a real summary of the platform's
 * financial and user state at a glance: users by role, book pipeline,
 * revenue split three ways (company/author/affiliate), and a preview of
 * the most recent transactions. Financial figures are hidden for EDITOR
 * per "Editor cannot access financial information".
 */
export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "EDITOR" && role !== "ACCOUNTANT") redirect("/account");

  const [userCount, usersByRole, bookCounts, pendingBooks, pendingBlogs, pendingPayouts] = await Promise.all([
    prisma.user.count(),
    prisma.user.groupBy({ by: ["role"], _count: { role: true } }),
    prisma.book.groupBy({ by: ["status"], _count: { status: true } }),
    prisma.book.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.blog.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.payoutRequest.count({ where: { status: "REQUESTED" } }),
  ]);

  let companyRevenue = 0;
  let authorRevenue = 0;
  let affiliateRevenue = 0;
  let totalOrders = 0;
  if (canViewFinancials(role)) {
    const [agg, orderCount] = await Promise.all([
      prisma.saleLine.aggregate({ _sum: { companyShare: true, authorShare: true, affiliateShare: true } }),
      prisma.order.count({ where: { status: "PAID" } }),
    ]);
    companyRevenue = Number(agg._sum.companyShare ?? 0);
    authorRevenue = Number(agg._sum.authorShare ?? 0);
    affiliateRevenue = Number(agg._sum.affiliateShare ?? 0);
    totalOrders = orderCount;
  }

  const recentTransactions = canViewFinancials(role) ? (await getTransactionLedger()).slice(0, 5) : [];

  const statusCount = (status: string) =>
    bookCounts.find((b: { status: string; _count: { status: number } }) => b.status === status)?._count.status ?? 0;
  const roleCount = (r: string) =>
    usersByRole.find((u: { role: string; _count: { role: number } }) => u.role === r)?._count.role ?? 0;

  return (
    <AdminShell role={role} activeKey="dashboard" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>{role === "ADMIN" ? "Admin" : role === "EDITOR" ? "Editor" : "Accountant"} dashboard</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>Platform-wide overview.</p>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
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
          <div className="stat-label">Needs your attention</div>
          <div className="stat-value">{pendingBooks + pendingBlogs + pendingPayouts}</div>
          <div className="stat-sub">Books, posts &amp; payouts pending</div>
        </div>
        {canViewFinancials(role) && (
          <div className="stat-card">
            <div className="stat-label">Total orders</div>
            <div className="stat-value">{totalOrders}</div>
            <div className="stat-sub">Paid, all time</div>
          </div>
        )}
      </div>

      {canViewFinancials(role) && (
        <>
          <h3 style={{ fontSize: 16, margin: "0 0 14px" }}>Who the money belongs to</h3>
          <div className="stat-grid" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-label">Company revenue</div>
              <div className="stat-value">${companyRevenue.toFixed(2)}</div>
              <div className="stat-sub">30% share, all time</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Author payouts</div>
              <div className="stat-value">${authorRevenue.toFixed(2)}</div>
              <div className="stat-sub">All time</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Affiliate payouts</div>
              <div className="stat-value">${affiliateRevenue.toFixed(2)}</div>
              <div className="stat-sub">All time</div>
            </div>
          </div>
        </>
      )}

      <h3 style={{ fontSize: 16, margin: "0 0 14px" }}>Users by role</h3>
      <div className="map-card" style={{ padding: "6px 16px", marginBottom: 24 }}>
        {(["READER", "AUTHOR", "EDITOR", "ADMIN"] as const).map((r) => (
          <div key={r} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
            <span style={{ fontSize: 13.5 }}>{r.charAt(0) + r.slice(1).toLowerCase()}</span>
            <span style={{ fontWeight: 700 }}>{roleCount(r)}</span>
          </div>
        ))}
      </div>

      {canViewFinancials(role) && (
        <>
          <div className="section-head" style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 16 }}>Recent transactions</h3>
            <Link href="/admin/transactions" className="see-all">View all →</Link>
          </div>
          <div className="map-card" style={{ padding: 0, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  {["Transaction ID", "Date", "Type", "Party", "Detail", "Amount", "Affiliate Commission"].map((h) => (
                    <th key={h} style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--ink-faint)", fontWeight: 600, fontSize: 11.5, textTransform: "uppercase", letterSpacing: "0.03em", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "24px 16px", color: "var(--ink-faint, var(--admin-text-faint))", fontSize: 13, textAlign: "center" }}>
                      No transactions recorded yet.
                    </td>
                  </tr>
                ) : (
                  recentTransactions.map((r) => (
                    <tr key={`${r.type}-${r.id}`}>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", fontFamily: "monospace", fontSize: 12 }}>{r.id.slice(0, 8).toUpperCase()}</td>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>
                        {new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}><span className="age-pill">{r.type}</span></td>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{r.party}</td>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)" }}>{r.detail}</td>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", fontWeight: 700 }}>
                        {r.type === "Payout" ? "-" : ""}${r.amount.toFixed(2)}
                      </td>
                      <td style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", color: r.affiliateInfo === "—" ? "var(--ink-faint)" : "#1F6B48", fontWeight: r.affiliateInfo === "—" ? 400 : 700 }}>
                        {r.affiliateInfo}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </AdminShell>
  );
}
