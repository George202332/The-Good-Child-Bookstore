import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { InvestorShell } from "@/components/InvestorShell";
import { PayoutsTable } from "@/app/admin/payouts/PayoutsTable";
import { getPayoutLedger } from "@/actions/payout-ledger";

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

  return (
    <InvestorShell activeKey="payouts" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Payout Requests</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Every payout ever queued, read-only.
          </p>
        </div>
      </div>

      {"error" in ledger ? (
        <div className="map-card" style={{ padding: 16, color: "var(--coral-deep)", fontSize: 13 }}>{ledger.error}</div>
      ) : (
        <PayoutsTable rows={ledger} canModerate={false} />
      )}
    </InvestorShell>
  );
}
