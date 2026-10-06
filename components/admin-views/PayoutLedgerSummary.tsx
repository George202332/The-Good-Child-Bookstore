import type { PayoutLedgerRow } from "@/actions/payout-ledger";
import { computePayoutTotals } from "@/lib/payout-ledger-totals";
import { ROLLED_LABEL } from "@/lib/payout-status";

/**
 * The Payout Requests stat cards and the three read-only export buttons, split out of
 * app/admin/payouts/page.tsx so app/investor/payouts/page.tsx renders the
 * exact same markup. The exports hit /api/admin/payout-ledger, which
 * authorizes ADMIN, ACCOUNTANT and INVESTOR via getPayoutLedger and only
 * ever reads.
 */
export function PayoutStatCards({ rows }: { rows: PayoutLedgerRow[] }) {
  const totals = computePayoutTotals(rows);
  return (
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
        <div className="stat-label">{ROLLED_LABEL}</div>
        <div className="stat-value">${totals.categoryA.toFixed(2)}</div>
        <div className="stat-sub">Under $30 — rolling over ({totals.categoryACount})</div>
      </div>
      <div className="stat-card stat-card-total">
        <div className="stat-label">Scheduled</div>
        <div className="stat-value">${totals.categoryB.toFixed(2)}</div>
        <div className="stat-sub">Pending, due by the 15th ({totals.categoryBCount}): scheduled ${totals.categoryBScheduled.toFixed(2)} + queued ${totals.categoryBQueued.toFixed(2)}</div>
      </div>
      <div className="stat-card stat-card-promotion">
        <div className="stat-label">This Cycle&apos;s New Earnings</div>
        <div className="stat-value">${totals.liveTotal.toFixed(2)}</div>
        <div className="stat-sub">Live: current month, not yet released</div>
      </div>
      <div className="stat-card stat-card-referral">
        <div className="stat-label">Average Payout</div>
        <div className="stat-value">${totals.averagePayout.toFixed(2)}</div>
        <div className="stat-sub">Across {totals.paidCount} paid payout{totals.paidCount === 1 ? "" : "s"}</div>
      </div>
    </div>
  );
}

/** The three payout export buttons (CSV, Excel, PDF), shared by the
 * admin and investor payouts pages. Each downloads the same table of
 * payouts due (lib/payout-export.ts). */
export function PayoutExportLinks() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page navigation */}
      <a href="/api/admin/payout-ledger?format=csv" className="btn btn-primary btn-small">
        CSV
      </a>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page navigation */}
      <a href="/api/admin/payout-ledger?format=xlsx" className="btn btn-ghost btn-small">
        Excel
      </a>
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- file download, not a page navigation */}
      <a href="/api/admin/payout-ledger?format=pdf" className="btn btn-ghost btn-small">
        PDF
      </a>
    </>
  );
}
