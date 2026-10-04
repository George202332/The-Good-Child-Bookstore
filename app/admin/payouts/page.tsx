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

  // 8-card restructure (Amendment 4). Category A/B are the two genuinely
  // distinct buckets a released-but-unqueued balance naturally splits
  // into once the real $30 threshold is enforced (see
  // actions/payout-ledger.ts getPendingUnqueuedRows):
  //   - Category A "ON_HOLD" — still under $30, rolling over.
  //   - Category B "SCHEDULED" — crossed $30, confirmed, waiting on the
  //     15th deadline (or an admin queuing/paying it directly).
  // Cards 7 & 8 are discretionary (see report): "This Cycle's New
  // Earnings" (the still-open current month's LIVE accrual — distinct
  // from Category A, since it hasn't even released yet, let alone been
  // measured against the threshold) and "Average Payout" (the average
  // amount across every payout actually PAID so far, a different signal
  // from a simple paid count).
  const totals = rows.reduce(
    (acc, r) => ({
      royalties: acc.royalties + r.bookSalesEarnings,
      affiliate: acc.affiliate + r.referralEarnings + r.commissionEarnings,
      combined: acc.combined + r.combinedTotal,
      paidCount: acc.paidCount + (r.paid ? 1 : 0),
      paidTotal: acc.paidTotal + (r.paid ? r.combinedTotal : 0),
      categoryA: acc.categoryA + (r.status === "ON_HOLD" ? r.combinedTotal : 0),
      categoryACount: acc.categoryACount + (r.status === "ON_HOLD" ? 1 : 0),
      categoryB: acc.categoryB + (r.status === "SCHEDULED" ? r.combinedTotal : 0),
      categoryBCount: acc.categoryBCount + (r.status === "SCHEDULED" ? 1 : 0),
      liveTotal: acc.liveTotal + (r.status === "LIVE" ? r.combinedTotal : 0),
    }),
    { royalties: 0, affiliate: 0, combined: 0, paidCount: 0, paidTotal: 0, categoryA: 0, categoryACount: 0, categoryB: 0, categoryBCount: 0, liveTotal: 0 }
  );
  const averagePayout = totals.paidCount > 0 ? totals.paidTotal / totals.paidCount : 0;

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
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page navigation */}
          <a href="/api/admin/payout-ledger?format=xlsx" className="btn btn-ghost btn-small">
            Export Excel
          </a>
          {/* Wise/Payoneer-manual-bulk-upload-compatible file (Amendment
              6) — scoped to Category B/"Scheduled" rows only (the only
              ones actually payout-eligible right now), one row per
              transfer. This is a file-format export only: no live Wise
              or Payoneer API call is made anywhere in this app. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page navigation */}
          <a href="/api/admin/payout-ledger?format=wise-batch" className="btn btn-ghost btn-small">
            Wise/Payoneer Batch (CSV)
          </a>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page navigation */}
          <a href="/api/admin/payout-ledger?format=wise-batch-xlsx" className="btn btn-ghost btn-small">
            Wise/Payoneer Batch (Excel)
          </a>
        </div>
      </div>

      <div className="stat-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Royalties</div>
          <div className="stat-value">${totals.royalties.toFixed(2)}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Affiliate Earnings</div>
          <div className="stat-value">${totals.affiliate.toFixed(2)}</div>
          <div className="stat-sub">All time</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Combined Total</div>
          <div className="stat-value">${totals.combined.toFixed(2)}</div>
          <div className="stat-sub">Royalties + affiliate</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Paid Total</div>
          <div className="stat-value">${totals.paidTotal.toFixed(2)}</div>
          <div className="stat-sub">{totals.paidCount} payout{totals.paidCount === 1 ? "" : "s"} paid</div>
        </div>
        <div className="stat-card stat-card-due">
          <div className="stat-label">On Hold</div>
          <div className="stat-value">${totals.categoryA.toFixed(2)}</div>
          <div className="stat-sub">Under $30 — rolling over ({totals.categoryACount})</div>
        </div>
        <div className="stat-card stat-card-total">
          <div className="stat-label">Scheduled</div>
          <div className="stat-value">${totals.categoryB.toFixed(2)}</div>
          <div className="stat-sub">Crossed $30 — due by the 15th ({totals.categoryBCount})</div>
        </div>
        <div className="stat-card stat-card-promotion">
          <div className="stat-label">This Cycle&apos;s New Earnings</div>
          <div className="stat-value">${totals.liveTotal.toFixed(2)}</div>
          <div className="stat-sub">Current month, not yet released</div>
        </div>
        <div className="stat-card stat-card-referral">
          <div className="stat-label">Average Payout</div>
          <div className="stat-value">${averagePayout.toFixed(2)}</div>
          <div className="stat-sub">Across {totals.paidCount} paid payout{totals.paidCount === 1 ? "" : "s"}</div>
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
