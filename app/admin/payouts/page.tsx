import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { PayoutsTable } from "./PayoutsTable";
import { QueuePayoutsButton } from "./QueuePayoutsButton";
import { getPayoutLedger } from "@/actions/payout-ledger";
import type { Role } from "@/lib/roles";
import { PayoutStatCards, PayoutExportLinks } from "@/components/admin-views/PayoutLedgerSummary";

/**
 * The admin payout ledger — every payout ever queued, whatever its
 * status (previously this page only showed the ones still pending
 * approval, filtered to status "REQUESTED", which is why George
 * couldn't find a record of anything already paid or rejected). See
 * actions/payout-ledger.ts for where this data comes from, and
 * app/api/admin/payout-ledger/route.ts for the CSV (manual bulk-payment
 * format) and PDF (internal record) exports below.
 *
 * Payouts are executed manually by an admin outside this system — the
 * "Queue this month's due payouts" button (actions/payouts.ts
 * queueDuePayouts) replaces the old automatic monthly cron, and
 * "Mark paid"/"Reject" (ModerationActions, unchanged) still only apply
 * to a row still in the REQUESTED state and are still Admin-only —
 * Accountant keeps view-only access to the whole ledger, matching the
 * existing role split.
 */
export default async function PayoutsPage() {
  const session = await authAdmin();
  if (!session?.user) redirect("/admin/login");
  const role = session.user.role as Role;
  if (role === "INVESTOR") redirect("/investor/payouts");
  if (role !== "ADMIN" && role !== "ACCOUNTANT") redirect("/admin");

  const ledger = await getPayoutLedger();
  const ledgerError = "error" in ledger ? ledger.error : null;
  const rows = ledgerError ? [] : (ledger as Exclude<typeof ledger, { error: string }>);

  return (
    <AdminShell role={role} activeKey="payouts" displayName={session.user.name ?? ""}>
      <div className="section-head" style={{ marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20 }}>Payout Requests</h2>
          <p style={{ color: "var(--ink-soft)", fontSize: 13.5, marginTop: 2 }}>
            Every payout ever queued — completed, rejected, or still owed. Payouts are sent manually; use the exports
            below to drive that.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {role === "ADMIN" && <QueuePayoutsButton />}
          <PayoutExportLinks />
        </div>
      </div>

      <PayoutStatCards rows={rows} />

      {ledgerError && (
        <div className="map-card" style={{ padding: 16, marginBottom: 16, color: "var(--coral-deep)", fontSize: 13 }}>
          Couldn&apos;t load the payout ledger: {ledgerError}
        </div>
      )}

      <PayoutsTable rows={rows} canModerate={role === "ADMIN"} />
    </AdminShell>
  );
}
