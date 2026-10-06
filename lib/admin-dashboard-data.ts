import { prisma } from "@/lib/prisma";
import { canViewFinancials } from "@/lib/roles";
import type { Role } from "@/lib/roles";
import { getTransactionLedger } from "@/actions/transactions";

/**
 * The single data loader behind the admin dashboard (app/admin/page.tsx)
 * and the Investor dashboard (app/investor/page.tsx), so both always show
 * exactly the same figures. Financial figures and recent transactions are
 * only loaded for roles that canViewFinancials (never EDITOR).
 */
export async function loadDashboardData(role: Role) {
  // Always live data — the site-wide Live/Test mode is no longer
  // admin-toggleable; it stays at whatever it was last set to.
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
      // a PAID status, so it moves in lockstep with real transactions.
      prisma.order.count({ where: { status: "PAID", isTestData, lines: { some: {} } } }),
    ]);
    companyRevenue = Number(agg._sum.companyShare ?? 0);
    authorRevenue = Number(agg._sum.authorShare ?? 0);
    affiliateRevenue = Number(agg._sum.affiliateShare ?? 0);
    totalOrders = orderCount;
  }

  const recentTransactions = canViewFinancials(role) ? (await getTransactionLedger()).slice(0, 5) : [];

  const statusCount = (status: string) =>
    bookCounts.find((b) => b.status === status)?._count.status ?? 0;
  const roleCount = (r: string) =>
    usersByRole.find((u) => u.role === r)?._count.role ?? 0;

  return {
    userCount,
    statusCount,
    roleCount,
    pendingBooks,
    pendingBlogs,
    pendingPayouts,
    totalOrders,
    companyRevenue,
    authorRevenue,
    affiliateRevenue,
    recentTransactions,
  };
}
