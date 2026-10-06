import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { InvestorShell } from "@/components/InvestorShell";
import { PayoutsTable } from "@/app/admin/payouts/PayoutsTable";
import { getPayoutLedger } from "@/actions/payout-ledger";
import { PayoutStatCards, PayoutExportLinks } from "@/components/admin-views/PayoutLedgerSummary";

/**
 * Investor's read-only mirror of the admin Payout Requests table
 * (Amendment 12) — the EXACT same PayoutsTable component Admin/
 * Accountant use, just with `canModerate` hard-set to false, same as
 * how Accountant already uses this component today. No "Queue this
 * month's due payouts" button either (that's Admin-only there too).
 */
export default async function InvestorPayoutsPage() {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role;
  if (role !== "INVESTOR" && role !== "ADMIN") redirect("/admin");

  const ledger = await getPayoutLedger();
  const ledgerError = "error" in ledger ? ledger.error : null;
  const rows = ledgerError ? [] : (ledger as Exclude<typeof ledger, { error: string }>);

  return (
    <InvestorShell activeKey="payouts" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Payout Requests</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Every payout ever queued — completed, rejected, or still owed. Payouts are sent manually; use the exports
            below to drive that.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <PayoutExportLinks />
        </div>
      </div>

      <PayoutStatCards rows={rows} />

      {ledgerError && (
        <div className="map-card" style={{ padding: 16, marginBottom: 16, color: "var(--coral-deep)", fontSize: 13 }}>
          Couldn&apos;t load the payout ledger: {ledgerError}
        </div>
      )}

      <PayoutsTable rows={rows} canModerate={false} />
    </InvestorShell>
  );
}
