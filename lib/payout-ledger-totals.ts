import type { PayoutLedgerRow } from "@/actions/payout-ledger";
import { isRolledLedgerStatus } from "@/lib/payout-status";

/**
 * The totals behind the Payout Requests stat cards, shared by the admin
 * payouts page and the Investor payouts page so both always show the
 * same numbers. Category A is the "Rolled" bucket (under $30, rolling
 * over — see lib/payout-status.ts), Category B is "Scheduled" (crossed
 * $30, due by the 15th).
 */
export function computePayoutTotals(rows: PayoutLedgerRow[]) {
  const totals = rows.reduce(
    (acc, r) => ({
      royalties: acc.royalties + r.bookSalesEarnings,
      affiliate: acc.affiliate + r.referralEarnings + r.commissionEarnings,
      combined: acc.combined + r.combinedTotal,
      // A consolidated row that mixes paid and unpaid payouts (see
      // lib/payout-ledger-dedupe.ts) still counts the paid part.
      paidCount: acc.paidCount + (r.paid || (r.paidAmount ?? 0) > 0 ? 1 : 0),
      paidTotal: acc.paidTotal + (r.paid ? r.combinedTotal : r.paidAmount ?? 0),
      categoryA: acc.categoryA + (isRolledLedgerStatus(r.status) ? r.combinedTotal : 0),
      categoryACount: acc.categoryACount + (isRolledLedgerStatus(r.status) ? 1 : 0),
      categoryB: acc.categoryB + (r.status === "SCHEDULED" ? r.combinedTotal : 0),
      categoryBCount: acc.categoryBCount + (r.status === "SCHEDULED" ? 1 : 0),
      liveTotal: acc.liveTotal + (r.status === "LIVE" ? r.combinedTotal : 0),
    }),
    { royalties: 0, affiliate: 0, combined: 0, paidCount: 0, paidTotal: 0, categoryA: 0, categoryACount: 0, categoryB: 0, categoryBCount: 0, liveTotal: 0 }
  );
  const averagePayout = totals.paidCount > 0 ? totals.paidTotal / totals.paidCount : 0;
  return { ...totals, averagePayout };
}
