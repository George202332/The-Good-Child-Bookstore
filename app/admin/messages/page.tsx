import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { loadDepartmentInbox } from "@/actions/admin-departments";
import { isDepartmentKey } from "@/lib/departments-server";
import type { DepartmentKey } from "@/lib/message-departments";
import { AdminMessagesList } from "./AdminMessagesList";

/**
 * The back end's Messages area: ONE inbox per department (Editor, Chief Editor, Payouts, Accounting, Operations).
 * Staff only see the departments they belong to; Admin sees all of them plus an overall view. The check is made on the
 * server in actions/admin-departments.ts, not only by hiding tabs here.
 */
export default async function AdminMessagesPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (role === "INVESTOR") redirect("/admin");

  const { d } = await searchParams;
  const first = await loadDepartmentInbox("ALL");
  if (!first) redirect("/admin");
  const wanted: DepartmentKey | "ALL" = d === "ALL" && first.isAdmin ? "ALL" : d && isDepartmentKey(d) && first.allowed.includes(d) ? d : first.isAdmin ? "ALL" : (first.allowed[0] ?? "ALL");
  const inbox = wanted === "ALL" && first.isAdmin ? first : await loadDepartmentInbox(wanted);

  return (
    <AdminShell role={role} activeKey="messages" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Messages</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            One inbox for each department. Replying reaches the person&apos;s Messages page and their email. Resolved messages are kept, never deleted.
          </p>
        </div>
      </div>
      <AdminMessagesList inbox={inbox ?? first} active={wanted} />
    </AdminShell>
  );
}
