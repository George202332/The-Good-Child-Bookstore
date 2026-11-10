import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { DashboardOverview } from "@/components/admin-views/DashboardOverview";
import { loadDashboardData } from "@/lib/admin-dashboard-data";
import { listNeedsAction } from "@/lib/review-notify";
import Link from "next/link";
import { heldCount } from "@/lib/personal-message-db";

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
  if (role === "INVESTOR") redirect("/investor/accounting");
  if (role !== "ADMIN" && role !== "EDITOR" && role !== "ACCOUNTANT") redirect("/account");

  const data = await loadDashboardData(role);
  const needsAction = role === "ADMIN" || role === "EDITOR" ? await listNeedsAction().catch(() => []) : [];
  const heldMessages = role === "ADMIN" || role === "EDITOR" ? await heldCount() : 0;

  return (
    <AdminShell role={role} activeKey="dashboard" displayName={session.user.name ?? ""}>
      {heldMessages > 0 && (
        <div role="status" style={{ marginBottom: 12, padding: "12px 16px", borderRadius: 12, background: "#F5D98F", color: "#6B4503" }}>
          <strong style={{ fontSize: 14 }}>Needs action: {heldMessages}</strong>{" "}
          <Link href="/admin/personal-messages" style={{ color: "inherit", fontWeight: 600 }}>{heldMessages === 1 ? "A Personal Message is" : "Personal Messages are"} held and waiting for a decision</Link>
        </div>
      )}
      {needsAction.length > 0 && (
        <div role="status" style={{ marginBottom: 18, padding: "14px 16px", borderRadius: 12, background: "#F5D98F", color: "#6B4503" }}>
          <strong style={{ fontSize: 14 }}>Needs action: {needsAction.length}</strong>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13.5 }}>
            {needsAction.slice(0, 8).map((n) => (
              <li key={n.id}>
                <Link href={`/admin/books/${n.id}/review`} style={{ color: "inherit", fontWeight: 600 }}>
                  {n.kind === "posted" ? "A new book has been posted" : "A book has been edited"}: {n.title}
                </Link>
              </li>
            ))}
          </ul>
          {needsAction.length > 8 && <Link href="/admin/books?status=PENDING_REVIEW" style={{ color: "inherit", fontSize: 13 }}>See all {needsAction.length}</Link>}
        </div>
      )}
      <DashboardOverview
        role={role}
        heading={`${role === "ADMIN" ? "Admin" : role === "EDITOR" ? "Editor" : "Accountant"} dashboard`}
        {...data}
        transactionsHref="/admin/transactions"
      />
    </AdminShell>
  );
}
