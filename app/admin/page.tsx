import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { DashboardOverview } from "@/components/admin-views/DashboardOverview";
import { loadDashboardData } from "@/lib/admin-dashboard-data";

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

  const data = await loadDashboardData(role);

  return (
    <AdminShell role={role} activeKey="dashboard" displayName={session.user.name ?? ""}>
      <DashboardOverview
        role={role}
        heading={`${role === "ADMIN" ? "Admin" : role === "EDITOR" ? "Editor" : "Accountant"} dashboard`}
        {...data}
        transactionsHref="/admin/transactions"
      />
    </AdminShell>
  );
}
