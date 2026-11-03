import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { InvestorShell } from "@/components/InvestorShell";
import { AnalyticsSummaryView } from "@/components/admin-views/AnalyticsSummaryView";
import { getAnalyticsSummary } from "@/actions/analytics";

export default async function InvestorAnalyticsPage() {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  // Investors now see only Accounting and Lulu Publishing; an Admin may still preview this page.
  if (role === "INVESTOR") redirect("/investor/accounting");
  if (role !== "ADMIN") redirect("/admin");

  const data = await getAnalyticsSummary();

  return (
    <InvestorShell activeKey="analytics" displayName={session.user.name ?? ""}>
      <AnalyticsSummaryView data={data} />
    </InvestorShell>
  );
}
