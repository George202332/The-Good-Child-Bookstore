import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { buildAccountingView } from "@/lib/accounting/service";
import { isMonthKey, monthKeyOf } from "@/lib/accounting/period";
import { AccountingClient } from "@/components/accounting/AccountingClient";

export const dynamic = "force-dynamic";

/** Admin > Accounting. Admin only (the page redirects everyone else; every action re-checks the role on the server). */
export default async function AccountingPage({ searchParams }: { searchParams?: Promise<{ month?: string; test?: string }> }) {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  if (session.user.role === "INVESTOR") redirect("/investor/accounting");
  if (session.user.role !== "ADMIN") redirect("/admin");

  const sp = (await searchParams) ?? {};
  const selection = sp.month === "lifetime" || isMonthKey(sp.month) ? sp.month : monthKeyOf(new Date());
  const view = await buildAccountingView(selection, sp.test !== "0");

  return (
    <AdminShell role="ADMIN" activeKey="accounting" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Accounting</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            All company income and costs, month by month and lifetime. Click any figure to see the transactions behind it.
          </p>
        </div>
      </div>
      <AccountingClient view={view} readOnly={false} base="/admin/accounting" />
    </AdminShell>
  );
}
