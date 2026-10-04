import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { AnalyticsSummaryView } from "@/components/admin-views/AnalyticsSummaryView";
import { getAnalyticsSummary } from "@/actions/analytics";

/**
 * Analytics — the brief's Revenue/Orders/Books Sold/Top Books/Monthly
 * Growth requirements, built entirely from real SaleLine/Order data (see
 * actions/analytics.ts). No simulated charts. EDITOR sees volume metrics
 * only, per "Editor cannot access financial information".
 */
export default async function AnalyticsPage() {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (role === "INVESTOR") redirect("/investor/sales-analytics");
  if (role !== "ADMIN" && role !== "EDITOR" && role !== "ACCOUNTANT") redirect("/account");

  const data = await getAnalyticsSummary();

  return (
    <AdminShell role={role} activeKey="analytics" displayName={session.user.name ?? ""}>
      <AnalyticsSummaryView data={data} />
    </AdminShell>
  );
}
