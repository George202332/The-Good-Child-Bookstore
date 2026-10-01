import { redirect } from "next/navigation";
import { authAdmin } from "@/lib/auth-admin";
import { AdminShell } from "@/components/AdminShell";
import { PayoutsTable } from "./PayoutsTable";
import { QueuePayoutsButton } from "./QueuePayoutsButton";
import { getPayoutLedger } from "@/actions/payout-ledger";
import type { Role } from "@/lib/roles";

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
  if (role !== "ADMIN" && role !== "ACCOUNTANT") redirect("/admin");

  const ledger = await getPayoutLedger();
  const ledgerError = "error" in ledger ? ledger.error : null;
  const rows = ledgerError ? [] : (ledger as Exclude<typeof ledger, { error: string }>);

  const totals = rows.reduce(
    (acc, r) => ({
      bookSales: acc.bookSales + r.bookSalesEarnings,
      affiliate: acc.affiliate + r.referralEarnings + r.commissionEarnings,
      combined: acc.combined + r.combinedTotal,
      paidCount: acc.paidCount + (r.paid ? 1 : 0),
    }),
    { bookSales: 0, affiliate: 0, combined: 0, paidCount: 0 }
  );

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
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page navigation */}
          <a href="/api/admin/payout-ledger?format=csv" className="btn btn-primary btn-small">
            Export Payout CSV
          </a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page navigation */}
          <a href="/api/admin/payout-ledger?format=pdf" className="btn btn-ghost btn-small">
            Download PDF
          </a>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Book sales earnings</div>
          <div className="stat-value">${totals.bookSales.toFixed(2)}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Affiliate earnings</div>
          <div className="stat-value">${totals.affiliate.toFixed(2)}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Combined total</div>
          <div className="stat-value">${totals.combined.toFixed(2)}</div>
          <div className="stat-sub">Book sales + affiliate</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Paid / total</div>
          <div className="stat-value">{totals.paidCount} / {rows.length}</div>
          <div className="stat-sub">Payouts settled so far</div>
        </div>
      </div>

      {ledgerError && (
        <div className="map-card" style={{ padding: 16, marginBottom: 16, color: "var(--coral-deep)", fontSize: 13 }}>
          Couldn&apos;t load the payout ledger: {ledgerError}
        </div>
      )}

      <PayoutsTable rows={rows} canModerate={role === "ADMIN"} />
    </AdminShell>
  );
}
