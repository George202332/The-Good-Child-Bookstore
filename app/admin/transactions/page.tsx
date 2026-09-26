import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { getTransactionLedger } from "@/actions/transactions";
import { canViewFinancials } from "@/lib/roles";
import { TransactionsTable } from "./TransactionsTable";

/** Unified transaction ledger — every sale and every payout, one table,
 * 7 columns. Financial data, so gated the same way as Analytics (Editor
 * cannot access financial information). Clicking a row opens a pop-up
 * with that transaction's full details (see TransactionsTable.tsx) —
 * same pattern as the admin Users table. */
export default async function TransactionsPage() {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (role !== "ADMIN" && role !== "EDITOR" && role !== "ACCOUNTANT") redirect("/account");
  if (!canViewFinancials(role)) redirect("/admin");

  const rows = await getTransactionLedger();

  return (
    <AdminShell role={role} activeKey="transactions" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Transactions</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Every individual book sale and every payout, most recent first — including which affiliate, if any,
            earned a commission on each sale. Click a row for full details.
          </p>
        </div>
      </div>
      <TransactionsTable rows={rows} canDelete={role === "ADMIN"} />
    </AdminShell>
  );
}
