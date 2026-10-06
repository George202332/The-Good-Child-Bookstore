import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { InvestorShell } from "@/components/InvestorShell";
import { DashboardOverview } from "@/components/admin-views/DashboardOverview";
import { loadDashboardData } from "@/lib/admin-dashboard-data";

/**
 * Investor's read-only mirror of the Admin dashboard (Amendment 12) —
 * same loader (lib/admin-dashboard-data.ts), same DashboardOverview body as app/admin/page.tsx, just
 * always with full financial visibility (Investor always passes
 * canViewFinancials) and linking to /investor/transactions instead of
 * /admin/transactions.
 */
export default async function InvestorDashboardPage() {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (role !== "INVESTOR" && role !== "ADMIN") redirect("/admin");

  const data = await loadDashboardData(role);

  return (
    <InvestorShell activeKey="dashboard" displayName={session.user.name ?? ""}>
      <DashboardOverview
        role="INVESTOR"
        heading="Investor dashboard"
        {...data}
        transactionsHref="/investor/transactions"
      />
    </InvestorShell>
  );
}
