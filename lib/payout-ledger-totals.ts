import type { PayoutLedgerRow } from "@/actions/payout-ledger";
import { isSyntheticLedgerRow, releasedPortion, unreleasedPortion } from "@/lib/payout-ledger-dedupe";

/**
 * The totals behind the Payout Requests stat cards, shared by the admin
 * payouts page and the Investor payouts page so both always show the
 * same numbers. Category A is the "Rolled" bucket (under $30, rolling
 * over — see lib/payout-status.ts), Category B is "Scheduled" (crossed
 * $30, due by the 15th).
 *
 * An account's rolled/scheduled balance and its current, still-open
 * month are ONE merged ledger row (lib/payout-ledger-dedupe.ts), so each
 * card counts that row's own parts: the released part feeds Rolled (or
 * Scheduled), the unreleased part feeds "This Cycle's New Earnings" —
 * exactly the figures the two separate rows used to carry.
 */
/** The released-but-under-$30 part of a row: the whole row when it is
 * Rolled (ON_HOLD), or just the released part of a merged On Hold row. */
function rolledPart(r: PayoutLedgerRow): number {
  return r.status === "ON_HOLD" || r.status === "LIVE" ? releasedPortion(r) : 0;
}

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
      categoryA: acc.categoryA + (rolledPart(r) > 0 ? rolledPart(r) : 0),
      categoryACount: acc.categoryACount + (rolledPart(r) > 0 ? 1 : 0),
      categoryB: acc.categoryB + (r.status === "SCHEDULED" ? releasedPortion(r) : 0),
      categoryBCount: acc.categoryBCount + (r.status === "SCHEDULED" ? 1 : 0),
      liveTotal: acc.liveTotal + (isSyntheticLedgerRow(r) ? unreleasedPortion(r) : 0),
    }),
    { royalties: 0, affiliate: 0, combined: 0, paidCount: 0, paidTotal: 0, categoryA: 0, categoryACount: 0, categoryB: 0, categoryBCount: 0, liveTotal: 0 }
  );
  const averagePayout = totals.paidCount > 0 ? totals.paidTotal / totals.paidCount : 0;
  return { ...totals, averagePayout };
}
