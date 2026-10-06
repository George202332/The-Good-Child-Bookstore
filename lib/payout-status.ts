import { MIN_PAYOUT_AMOUNT } from "./payout-threshold";
import { releaseDateFor } from "./wallet";

/**
 * ONE shared definition of the "Rolled" payout status, used by every
 * surface that shows a per-month payout status (the author/affiliate
 * Monthly Payout History table, the monthly statement PDF, the admin
 * payout ledger table, and the ledger's PDF/Excel/CSV exports) so the
 * label, the help text, the styling and — most importantly — the rule
 * itself can't drift apart between them.
 *
 * A balance is "Rolled" when ALL of these hold:
 *   1. its earnings month is closed and its release date has passed
 *      (lib/wallet.ts releaseDateFor: the 1st of the following month),
 *      i.e. the payout cycle for it has already run;
 *   2. the payable balance — the running total INCLUDING anything that
 *      rolled over from earlier months — is still under
 *      MIN_PAYOUT_AMOUNT ($30, lib/payout-threshold.ts); and
 *   3. it has not been paid.
 * It then simply keeps accumulating into the next month's cycle until
 * the running total reaches $30, at which point everything that rolled
 * is released together as one payout (and those earlier months then
 * read as part of that payout, not as Rolled any more).
 */

export const ROLLED_LABEL = "Rolled";

export const ROLLED_HELP = `Under $${MIN_PAYOUT_AMOUNT}, so this balance rolls into next month's payout cycle`;

/** Pill colours for "Rolled" — a muted violet, deliberately distinct
 * from Live (blue), Paid (green) and Pending/Queued (amber). Shared so
 * the table pill and the PDF/author page can't disagree. */
export const ROLLED_PILL_STYLE = { background: "rgba(108,84,160,0.16)", color: "#4B3A85" } as const;

function cents(n: number): number {
  return Math.round(n * 100);
}

/** True when `amount` is a real, nonzero balance still under the minimum. */
export function isUnderMinimum(amount: number): boolean {
  return cents(amount) > 0 && cents(amount) < cents(MIN_PAYOUT_AMOUNT);
}

/** The precise "Rolled" rule — see the module comment. */
export function isRolled(input: { releaseDatePassed: boolean; payableBalance: number; paid: boolean }): boolean {
  return input.releaseDatePassed && !input.paid && isUnderMinimum(input.payableBalance);
}

/** Admin-ledger flavour of the same rule. The ledger's synthetic
 * "ON_HOLD" (Category A) rows are, by construction (see
 * actions/payout-ledger.ts getPendingUnqueuedRows), already-released,
 * unpaid, unqueued balances that are still under $30 on both wallets —
 * exactly the Rolled definition — so they, and only they, read Rolled.
 * LIVE (the still-open month, not released) is a different thing and
 * keeps its own label. */
export function isRolledLedgerStatus(status: string): boolean {
  return status === "ON_HOLD";
}

/** One label function for the admin ledger table (and anything that
 * wants the same words). Mirrors the historic wording exactly, with
 * Category A rows now reading "Rolled". */
export function ledgerStatusLabel(status: string, paid: boolean): string {
  if (status === "LIVE") return "On Hold";
  if (paid) return "Paid";
  if (status === "REJECTED") return "Rejected";
  if (isRolledLedgerStatus(status)) return ROLLED_LABEL;
  if (status === "SCHEDULED") return "Scheduled";
  return "Queued"; // REQUESTED / APPROVED — a real PayoutRequest awaiting manual payment.
}

/** Whether a ledger row may ever be picked for "Mark as Paid" or put in
 * the payout export. A Rolled row is NOT payable — it is
 * under the minimum, so paying it would break the $30 rule. */
export function isLedgerRowPayable(status: string): boolean {
  return status === "REQUESTED" || status === "SCHEDULED";
}

// ---------------------------------------------------------------------------
// Per-month resolution for the author/affiliate Monthly Payout History
// ---------------------------------------------------------------------------

export interface MonthlyAmounts {
  monthKey: string; // "2026-01"
  year: number;
  month: number; // 0-based, like Date
  /** Author royalties earned in the month (the author wallet). */
  author: number;
  /** Referral + promotion earned in the month (the affiliate wallet). */
  affiliate: number;
}

export interface MonthlyResolution {
  /** True when nothing earned this month has been released yet because
   * every wallet involved is still under the minimum — status "Rolled". */
  rolled: boolean;
  /** For a month that is NOT rolled: the earnings month whose payout
   * cycle carried this month's money out. The month itself when it
   * crossed $30 on its own (or via carry-in), or the later month whose
   * addition lifted the running total past $30 when this month had
   * rolled earlier. null when rolled, or when the month has no money. */
  releasedWithMonthKey: string | null;
}

/**
 * Walks the user's closed months oldest-first, once per wallet (author
 * and affiliate are independent wallets with their own $30 test, exactly
 * as in actions/payouts.ts queueDuePayouts), carrying sub-$30 totals
 * forward the way the real wallet does (lib/wallet.ts: available is the
 * running released-minus-paid total, so a short month simply waits and
 * combines with the next).
 *
 * Example ($ per month, single wallet): month1 12 -> running 12, rolled.
 * month2 +10 -> 22, still rolled. month3 +15 -> 37 >= 30: released
 * together; months 1, 2 and 3 are all "released with month 3" and no
 * longer Rolled. The running total then resets to 0.
 *
 * The still-open current month is never resolved here (it is "Live").
 * Pure: `now` is a parameter.
 */
export function resolveMonthlyRollover(months: MonthlyAmounts[], now: Date): Map<string, MonthlyResolution> {
  const result = new Map<string, MonthlyResolution>();
  const sorted = [...months].sort((a, b) => (a.monthKey < b.monthKey ? -1 : a.monthKey > b.monthKey ? 1 : 0));
  const closed = sorted.filter((m) => now.getTime() >= releaseDateFor(new Date(m.year, m.month, 1)).getTime());

  const releasedWith = new Map<string, string[]>(); // monthKey -> cycle month keys per wallet that released it
  const stillRolled = new Map<string, boolean>(); // monthKey -> any wallet still rolled for it

  for (const wallet of ["author", "affiliate"] as const) {
    let running = 0;
    let waiting: string[] = [];
    for (const m of closed) {
      const amount = m[wallet];
      if (cents(amount) <= 0) continue;
      running += amount;
      waiting.push(m.monthKey);
      if (cents(running) >= cents(MIN_PAYOUT_AMOUNT)) {
        for (const key of waiting) releasedWith.set(key, [...(releasedWith.get(key) ?? []), m.monthKey]);
        waiting = [];
        running = 0;
      }
    }
    for (const key of waiting) stillRolled.set(key, true);
  }

  for (const m of closed) {
    const released = releasedWith.get(m.monthKey);
    if (released && released.length > 0) {
      // A month whose money was carried out by at least one wallet is
      // not Rolled; if both wallets released it, follow the earliest cycle.
      result.set(m.monthKey, { rolled: false, releasedWithMonthKey: [...released].sort()[0] });
    } else if (stillRolled.get(m.monthKey)) {
      result.set(m.monthKey, { rolled: true, releasedWithMonthKey: null });
    } else {
      result.set(m.monthKey, { rolled: false, releasedWithMonthKey: null });
    }
  }
  return result;
}
