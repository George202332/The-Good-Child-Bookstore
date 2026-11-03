import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { InvestorShell } from "@/components/InvestorShell";
import { buildAccountingView } from "@/lib/accounting/service";
import { isMonthKey, monthKeyOf } from "@/lib/accounting/period";
import { AccountingClient } from "@/components/accounting/AccountingClient";

export const dynamic = "force-dynamic";

/** Investor > Accounting: the same page as the Admin one, view only. The page passes readOnly, and the server refuses every write from an investor anyway. */
export default async function InvestorAccountingPage({ searchParams }: { searchParams?: Promise<{ month?: string; test?: string }> }) {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (role !== "INVESTOR" && role !== "ADMIN") redirect("/admin");

  const sp = (await searchParams) ?? {};
  const selection = sp.month === "lifetime" || isMonthKey(sp.month) ? sp.month : monthKeyOf(new Date());
  const view = await buildAccountingView(selection, sp.test !== "0");

  return (
    <InvestorShell activeKey="accounting" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Accounting</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Company income and costs, month by month and lifetime. View only. Click any figure to see the transactions behind it.
          </p>
        </div>
      </div>
      <AccountingClient view={view} readOnly base="/investor/accounting" />
    </InvestorShell>
  );
}
