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
export const LIVE_LABEL = "Live";
export const PENDING_LABEL = "Pending";
export const PAID_LABEL = "Paid";
export const REJECTED_LABEL = "Rejected";

export const ROLLED_HELP = `Under $${MIN_PAYOUT_AMOUNT}, so this balance rolls into next month's payout cycle`;
export const LIVE_HELP = "The current cycle's accumulating total, including any amount rolled over from earlier months. It keeps growing as sales land.";
export const PENDING_HELP = `The cycle has closed and the balance is at least $${MIN_PAYOUT_AMOUNT}. It is released and waiting to be paid, due by the 15th.`;

/**
 * THE payout lifecycle, as users see it:
 *
 *   Rolled  -> a closed balance under $30, carried into the next cycle
 *   Live    -> the current cycle's accumulating total, always including
 *              anything rolled in, updating in real time
 *   Pending -> the cycle has closed (and the balance is $30 or more):
 *              released, awaiting actual payment
 *   Paid / Rejected -> settled
 *
 * These are USER-FACING words only. The internal ledger statuses
 * (LIVE, ON_HOLD, SCHEDULED, REQUESTED, APPROVED, PROCESSING, PAID,
 * REJECTED — and the database PayoutStatus enum) are unchanged; every
 * surface maps them to a PayoutStatusKey through ledgerStatusKey() or
 * authorStatusKey() below and takes its label, help text and colours
 * from the ONE table here.
 */
export type PayoutStatusKey = "live" | "rolled" | "pending" | "paid" | "rejected";

export const PAYOUT_STATUS_LABELS: Record<PayoutStatusKey, string> = {
  live: LIVE_LABEL,
  rolled: ROLLED_LABEL,
  pending: PENDING_LABEL,
  paid: PAID_LABEL,
  rejected: REJECTED_LABEL,
};

export const PAYOUT_STATUS_HELP: Record<PayoutStatusKey, string> = {
  live: LIVE_HELP,
  rolled: ROLLED_HELP,
  pending: PENDING_HELP,
  paid: "The transfer has gone out.",
  rejected: "This payout was declined. Its money rolls back into the balance.",
};

/** One pill style per status. Rolled is a solid bright cyan with dark
 * text (about 9:1 contrast), deliberately not purple and not shared
 * with any other status: Live is blue, Paid green, Pending amber,
 * Rejected grey. A solid fill keeps it legible on both the light
 * author pages and the dark admin theme. */
export const PAYOUT_STATUS_PILL_STYLES: Record<PayoutStatusKey, { background: string; color: string }> = {
  live: { background: "rgba(36,81,183,0.14)", color: "#1B3C8F" },
  rolled: { background: "#22D3EE", color: "#083344" },
  pending: { background: "rgba(196,120,20,0.18)", color: "#B4650F" },
  paid: { background: "rgba(31,107,72,0.15)", color: "#165236" },
  rejected: { background: "rgba(107,115,133,0.15)", color: "#A6AEC2" },
};

/** The Rolled pill, kept as its own export for existing imports. */
export const ROLLED_PILL_STYLE = PAYOUT_STATUS_PILL_STYLES.rolled;

/** The same Rolled colour for PDFs, as 0-1 RGB components (a darker
 * cyan than the pill so the text stays readable on the cream page). */
export const ROLLED_PDF_RGB: readonly [number, number, number] = [0.03, 0.41, 0.52];

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

/** Maps an internal ledger status to the user-facing lifecycle key.
 *   LIVE                          -> live
 *   ON_HOLD                       -> rolled
 *   SCHEDULED, REQUESTED, APPROVED
 *   and any other open request     -> pending
 *   PAID                          -> paid
 *   REJECTED                      -> rejected */
export function ledgerStatusKey(status: string, paid: boolean): PayoutStatusKey {
  if (status === "LIVE") return "live";
  if (paid || status === "PAID") return "paid";
  if (status === "REJECTED") return "rejected";
  if (isRolledLedgerStatus(status)) return "rolled";
  return "pending"; // SCHEDULED, or a real PayoutRequest awaiting manual payment.
}

/** One label function for the admin ledger table, its filters and
 * anything that wants the same words. */
export function ledgerStatusLabel(status: string, paid: boolean): string {
  return PAYOUT_STATUS_LABELS[ledgerStatusKey(status, paid)];
}

export function ledgerStatusHelp(status: string, paid: boolean): string {
  return PAYOUT_STATUS_HELP[ledgerStatusKey(status, paid)];
}

export function ledgerStatusPillStyle(status: string, paid: boolean): { background: string; color: string } {
  return PAYOUT_STATUS_PILL_STYLES[ledgerStatusKey(status, paid)];
}

/** The author-facing monthly history statuses (lib/payout-monthly.ts)
 * mapped to the same lifecycle keys. */
export type AuthorMonthStatus = "Live" | "Paid" | "Pending payout" | "Rolled";
export function authorStatusKey(status: AuthorMonthStatus): PayoutStatusKey {
  if (status === "Live") return "live";
  if (status === "Paid") return "paid";
  if (status === "Rolled") return "rolled";
  return "pending";
}
export function authorStatusLabel(status: AuthorMonthStatus): string {
  return PAYOUT_STATUS_LABELS[authorStatusKey(status)];
}
export function authorStatusHelp(status: AuthorMonthStatus): string {
  return PAYOUT_STATUS_HELP[authorStatusKey(status)];
}
export function authorStatusPillStyle(status: AuthorMonthStatus): { background: string; color: string } {
  return PAYOUT_STATUS_PILL_STYLES[authorStatusKey(status)];
}

/** The status filter options shared by every status dropdown. `value`
 * is the lifecycle key; use ledgerStatusKey() to test a row. */
export const PAYOUT_STATUS_FILTER_OPTIONS: { value: PayoutStatusKey; label: string }[] = [
  { value: "live", label: LIVE_LABEL },
  { value: "rolled", label: ROLLED_LABEL },
  { value: "pending", label: PENDING_LABEL },
  { value: "paid", label: PAID_LABEL },
  { value: "rejected", label: REJECTED_LABEL },
];

/** The ColHelp text for the admin Status column. */
export const STATUS_COLUMN_HELP =
  `Rolled means a closed balance is still under the $${MIN_PAYOUT_AMOUNT} minimum, so it is carried into the next cycle. ` +
  `Live means the current cycle is still accumulating; its total always includes anything rolled in and keeps growing as sales land. ` +
  `Pending means the cycle has closed with $${MIN_PAYOUT_AMOUNT} or more, so the money is released and waiting to be paid (due by the 15th), whether or not a payout request has been queued yet. ` +
  `Paid means the transfer has gone out. Rejected means it was declined.`;

/** The unpaid, payable internal statuses: an unqueued released balance
 * (SCHEDULED) or a real queued request (REQUESTED / APPROVED). Both read
 * "Pending" to users. */
export function isPendingPaymentStatus(status: string): boolean {
  return status === "SCHEDULED" || status === "REQUESTED" || status === "APPROVED";
}

/** Whether a ledger row may ever be picked for "Mark as Paid" or put in
 * the payout export. A Rolled row is NOT payable — it is
 * under the minimum, so paying it would break the $30 rule. */
export function isLedgerRowPayable(status: string): boolean {
  return isPendingPaymentStatus(status);
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

// ---------------------------------------------------------------------------
// The author's LIVE total = current cycle + rolled-over balance
// ---------------------------------------------------------------------------

export interface LiveTotal {
  /** What the still-open cycle has accumulated on its own. */
  currentCycle: number;
  /** Released, unpaid balances that are still under $30 (the Rolled
   * amount), folded into the live figure. */
  rolledOver: number;
  /** currentCycle + rolledOver: the ONE live figure shown to the author. */
  total: number;
}

/**
 * The amount of a wallet that counts as "rolled over": its released,
 * unpaid, unqueued balance (lib/wallet.ts `available`) when it is
 * still under the $30 minimum. At $30 or more the balance is Pending
 * (it will be paid), not rolled; at 0 there is nothing to roll. The $30
 * test is per wallet, exactly as in actions/payouts.ts.
 *
 * Because `available` is already net of everything paid or queued,
 * paying a balance drops it to 0 here, so a paid amount is never
 * counted again in the live total.
 */
export function rolledOverOf(walletAvailable: number): number {
  return isUnderMinimum(walletAvailable) ? Math.round(walletAvailable * 100) / 100 : 0;
}

/** Live total for an author/affiliate: the current cycle's accumulating
 * amount plus the rolled-over balance of every wallet involved. Pure. */
export function computeLiveTotal(input: { currentCycle: number; walletAvailables: number[] }): LiveTotal {
  const currentCycle = Math.round(input.currentCycle * 100) / 100;
  const rolledOver = Math.round(input.walletAvailables.reduce((sum, a) => sum + rolledOverOf(a) * 100, 0)) / 100;
  return { currentCycle, rolledOver, total: Math.round((currentCycle + rolledOver) * 100) / 100 };
}

/** The small note under the live figure, or null when nothing rolled. */
export function rolledOverNote(rolledOver: number): string | null {
  return cents(rolledOver) > 0 ? `includes $${rolledOver.toFixed(2)} rolled over from earlier months` : null;
}

/**
 * How much balance rolled over INTO a given month's payout statement:
 * the amounts of the earlier months carried into it.
 *   - the current (Live) month: every earlier closed month that is
 *     still Rolled (they fold into the live total);
 *   - a closed month released together with earlier rolled months: those
 *     earlier months (their releasedWithMonthKey is this month);
 *   - a closed month that is itself still Rolled: the earlier months
 *     still Rolled alongside it (the running balance it carries);
 *   - otherwise 0.
 * Pure: `now` is a parameter. Uses resolveMonthlyRollover, so it follows
 * exactly the same rule as the Rolled status everywhere else.
 */
export function rolloverIntoMonth(targetMonthKey: string, months: MonthlyAmounts[], now: Date): number {
  const resolution = resolveMonthlyRollover(months, now);
  const target = months.find((m) => m.monthKey === targetMonthKey);
  if (!target) return 0;
  const targetIsLive = !resolution.has(targetMonthKey);
  const targetResolution = resolution.get(targetMonthKey);
  let sum = 0;
  for (const m of months) {
    if (m.monthKey >= targetMonthKey) continue;
    const r = resolution.get(m.monthKey);
    if (!r) continue;
    const carried =
      (targetIsLive && r.rolled) ||
      (!targetIsLive && r.releasedWithMonthKey === targetMonthKey) ||
      (!targetIsLive && targetResolution?.rolled === true && r.rolled);
    if (carried) sum += cents(m.author) + cents(m.affiliate);
  }
  return sum / 100;
}
