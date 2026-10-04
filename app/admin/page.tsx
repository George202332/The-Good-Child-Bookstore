import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/AdminShell";
import { DashboardOverview } from "@/components/admin-views/DashboardOverview";
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
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  // Investor (Amendment 12) has its own dashboard at /investor, never
  // this shared admin one — bounce it there instead of /account (which
  // would just dead-end, since this role has no reader/author profile).
  if (role === "INVESTOR") redirect("/investor");
  if (role !== "ADMIN" && role !== "EDITOR" && role !== "ACCOUNTANT") redirect("/account");

  // Always live data — the site-wide Live/Test mode is no longer
  // admin-toggleable (its Data Management screen was removed); it stays
  // at whatever it was last set to.
  const isTestData = false;

  const [userCount, usersByRole, bookCounts, pendingBooks, pendingBlogs, pendingPayouts] = await Promise.all([
    prisma.user.count({ where: { isTestData } }),
    prisma.user.groupBy({ by: ["role"], _count: { role: true }, where: { isTestData } }),
    prisma.book.groupBy({ by: ["status"], _count: { status: true }, where: { isTestData } }),
    prisma.book.count({ where: { status: "PENDING_REVIEW", isTestData } }),
    prisma.blog.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.payoutRequest.count({ where: { status: "REQUESTED" } }),
  ]);

  let companyRevenue = 0;
  let authorRevenue = 0;
  let affiliateRevenue = 0;
  let totalOrders = 0;
  if (canViewFinancials(role)) {
    const [agg, orderCount] = await Promise.all([
      prisma.saleLine.aggregate({ _sum: { companyShare: true, authorShare: true, affiliateShare: true }, where: { order: { isTestData } } }),
      // "Total orders" means orders with a real sale behind them —
      // requiring at least one SaleLine (lines: { some: {} }), not just
      // a PAID status, so this can never show a stale/phantom count:
      // it's derived straight from actual sale records, the same
      // records deleteTransaction removes (deleting an order's last
      // SaleLine deletes the order itself), so this number moves in
      // lockstep with real transactions with no separate counter
      // anywhere to fall out of sync.
      prisma.order.count({ where: { status: "PAID", isTestData, lines: { some: {} } } }),
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
      <DashboardOverview
        role={role}
        heading={`${role === "ADMIN" ? "Admin" : role === "EDITOR" ? "Editor" : "Accountant"} dashboard`}
        userCount={userCount}
        statusCount={statusCount}
        roleCount={roleCount}
        pendingBooks={pendingBooks}
        pendingBlogs={pendingBlogs}
        pendingPayouts={pendingPayouts}
        totalOrders={totalOrders}
        companyRevenue={companyRevenue}
        authorRevenue={authorRevenue}
        affiliateRevenue={affiliateRevenue}
        recentTransactions={recentTransactions}
        transactionsHref="/admin/transactions"
      />
    </AdminShell>
  );
}
