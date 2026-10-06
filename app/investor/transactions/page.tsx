import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { InvestorShell } from "@/components/InvestorShell";
import { getTransactionLedger } from "@/actions/transactions";
import { TransactionsTable } from "@/app/admin/transactions/TransactionsTable";

/** Investor's read-only mirror of the admin Transactions table
 * (Amendment 12) — same TransactionsTable component, `canDelete`
 * hard-set to false, no ResetOrdersButton (Admin-only there too). */
export default async function InvestorTransactionsPage() {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (role !== "INVESTOR" && role !== "ADMIN") redirect("/admin");

  const rows = await getTransactionLedger();

  return (
    <InvestorShell activeKey="transactions" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Transactions</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Every individual book sale and every payout, most recent first — including which affiliate, if any,
            earned a commission on each sale. Click a row for full details.
          </p>
        </div>
      </div>
      <TransactionsTable rows={rows} canDelete={false} />
    </InvestorShell>
  );
}
