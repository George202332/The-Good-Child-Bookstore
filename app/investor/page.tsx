import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { prisma } from "@/lib/prisma";
import { InvestorShell } from "@/components/InvestorShell";
import { DashboardOverview } from "@/components/admin-views/DashboardOverview";
import { getTransactionLedger } from "@/actions/transactions";

/**
 * Investor's read-only mirror of the Admin dashboard (Amendment 12) —
 * same queries, same DashboardOverview body as app/admin/page.tsx, just
 * always with full financial visibility (Investor always passes
 * canViewFinancials) and linking to /investor/transactions instead of
 * /admin/transactions.
 */
export default async function InvestorDashboardPage() {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (role !== "INVESTOR" && role !== "ADMIN") redirect("/admin");

  const isTestData = false;

  const [userCount, usersByRole, bookCounts, pendingBooks, pendingBlogs, pendingPayouts] = await Promise.all([
    prisma.user.count({ where: { isTestData } }),
    prisma.user.groupBy({ by: ["role"], _count: { role: true }, where: { isTestData } }),
    prisma.book.groupBy({ by: ["status"], _count: { status: true }, where: { isTestData } }),
    prisma.book.count({ where: { status: "PENDING_REVIEW", isTestData } }),
    prisma.blog.count({ where: { status: "PENDING_REVIEW" } }),
    prisma.payoutRequest.count({ where: { status: "REQUESTED" } }),
  ]);

  const [agg, orderCount] = await Promise.all([
    prisma.saleLine.aggregate({ _sum: { companyShare: true, authorShare: true, affiliateShare: true }, where: { order: { isTestData } } }),
    prisma.order.count({ where: { status: "PAID", isTestData, lines: { some: {} } } }),
  ]);
  const companyRevenue = Number(agg._sum.companyShare ?? 0);
  const authorRevenue = Number(agg._sum.authorShare ?? 0);
  const affiliateRevenue = Number(agg._sum.affiliateShare ?? 0);

  const recentTransactions = (await getTransactionLedger()).slice(0, 5);

  const statusCount = (status: string) =>
    bookCounts.find((b: { status: string; _count: { status: number } }) => b.status === status)?._count.status ?? 0;
  const roleCount = (r: string) =>
    usersByRole.find((u: { role: string; _count: { role: number } }) => u.role === r)?._count.role ?? 0;

  return (
    <InvestorShell activeKey="dashboard" displayName={session.user.name ?? ""}>
      <DashboardOverview
        role="INVESTOR"
        heading="Investor dashboard"
        userCount={userCount}
        statusCount={statusCount}
        roleCount={roleCount}
        pendingBooks={pendingBooks}
        pendingBlogs={pendingBlogs}
        pendingPayouts={pendingPayouts}
        totalOrders={orderCount}
        companyRevenue={companyRevenue}
        authorRevenue={authorRevenue}
        affiliateRevenue={affiliateRevenue}
        recentTransactions={recentTransactions}
        transactionsHref="/investor/transactions"
      />
    </InvestorShell>
  );
}
