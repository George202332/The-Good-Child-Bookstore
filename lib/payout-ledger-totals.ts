import type { PayoutLedgerRow } from "@/actions/payout-ledger";
import { isSyntheticLedgerRow, payableNowAmount, releasedPortion, unreleasedPortion } from "@/lib/payout-ledger-dedupe";

/**
 * The totals behind the Payout Requests stat cards, shared by the admin
 * payouts page and the Investor payouts page so both always show the
 * same numbers. Category A is the "Rolled" bucket (under $30, rolling
 * over — see lib/payout-status.ts), Category B is the "Scheduled" card:
 * EVERYTHING due to be paid out by the 15th, which is
 *   - scheduled balances: released, unqueued rows (SCHEDULED) at or over
 *     $30, counted at payableNowAmount (only the wallets that clear $30,
 *     never the live month), PLUS
 *   - queued payout requests: real REQUESTED / APPROVED rows that are not
 *     paid yet, counted at what is still outstanding.
 * Both read "Pending" in the table. The card used to count only the
 * first kind, so it went to $0 the moment payouts were queued (queued
 * money leaves the SCHEDULED rows and becomes REQUESTED rows).
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

/** What a row contributes to the Scheduled card: its payable-now amount
 * when it is Scheduled or Queued and unpaid, else 0. */
export function pendingDueAmount(r: PayoutLedgerRow): number {
  if (r.paid) return 0;
  if (r.status === "SCHEDULED" || r.status === "REQUESTED" || r.status === "APPROVED") return payableNowAmount(r);
  return 0;
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
      categoryB: acc.categoryB + pendingDueAmount(r),
      categoryBCount: acc.categoryBCount + (pendingDueAmount(r) > 0 ? 1 : 0),
      categoryBScheduled: acc.categoryBScheduled + (r.status === "SCHEDULED" ? pendingDueAmount(r) : 0),
      categoryBQueued: acc.categoryBQueued + (r.status === "REQUESTED" || r.status === "APPROVED" ? pendingDueAmount(r) : 0),
      liveTotal: acc.liveTotal + (isSyntheticLedgerRow(r) ? unreleasedPortion(r) : 0),
    }),
    { royalties: 0, affiliate: 0, combined: 0, paidCount: 0, paidTotal: 0, categoryA: 0, categoryACount: 0, categoryB: 0, categoryBCount: 0, categoryBScheduled: 0, categoryBQueued: 0, liveTotal: 0 }
  );
  const averagePayout = totals.paidCount > 0 ? totals.paidTotal / totals.paidCount : 0;
  return { ...totals, averagePayout };
}
