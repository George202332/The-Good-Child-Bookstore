/**
 * The pure, Prisma-free "one row per account per payout period" logic
 * for the admin payout ledger (actions/payout-ledger.ts), split out so
 * it can be unit-tested directly (tests/payout-ledger-dedupe.test.ts)
 * and so the ledger has ONE final guard that guarantees the invariant,
 * whatever the three row sources (live month, released-but-unqueued,
 * real PayoutRequests) happen to emit.
 *
 * PERIOD. A ledger row belongs to exactly one period:
 *   - LIVE / ON_HOLD / SCHEDULED ("open balance" rows, synthetic: they
 *     have no PayoutRequest yet) ... ALL one group, "open", per user.
 *     See OPEN BALANCE below.
 *   - REJECTED real rows ..... "rejected:<earnings month>" (kept apart
 *                              from live payouts: a rejected payout is a
 *                              closed fact, not an active one)
 *   - every other real row ... "cycle:<earnings month>" (reportMonthKey
 *                              — the month before the payout was queued)
 * Rows are grouped by (userId, period) and each group becomes ONE row.
 *
 * HOW A GROUP COLLAPSES
 *   1. Per earnings type (AUTHOR / AFFILIATE; synthetic rows are one
 *      combined type), rows with the identical amount to the cent are
 *      TWINS — the same payout shown twice (a double click, a race, a
 *      repeated run). Twins collapse to one amount; they are never
 *      summed. All their real ids stay in componentIds so a click on the
 *      one displayed row resolves every one of them and nothing is
 *      stranded as a hidden REQUESTED row.
 *   2. Remaining same-type rows with different amounts are summed.
 *   3. The AUTHOR part and the AFFILIATE part are then added column by
 *      column (royalties / referral / commission / total) — the normal
 *      dual-role (author + affiliate) account.
 *
 * STATUS RULE (the safe one): when the rows of a group disagree, the
 * UNPAID status wins — REQUESTED, then APPROVED, then PROCESSING, then
 * PAID. A row therefore never claims "Paid" while any part of it is
 * still outstanding, and an unpaid duplicate can never be hidden behind
 * a paid one. Conversely a paid part is never hidden behind an unpaid
 * one: it stays listed in `paidComponentIds` with its amount in
 * `paidAmount` (counted in the Paid Total, excluded from anything that
 * would pay or reject again — see actionableIds). Synthetic precedence
 * is SCHEDULED over ON_HOLD (the payable state wins).
 *
 * OPEN BALANCE (rolled + on hold = ONE row). The ledger has two synthetic
 * sources per account: the still-open current month (LIVE, "On Hold",
 * not yet released) and the released-but-unqueued balance (ON_HOLD, shown
 * "Rolled" while under $30, or SCHEDULED once payable). An account that
 * has money in both used to appear twice (periods "live:<month>" and
 * "unqueued"). They are now ONE row per user:
 *   - total and the royalties/referral/commission columns are the SUMS
 *     (a rolled $12 plus a live $8 is one $20 row, never 12 or 8);
 *   - same-slot twins still collapse (never summed), exactly as above —
 *     only the live slot and the unqueued slot are added to each other;
 *   - status: SCHEDULED if any released part is payable, else LIVE ("On
 *     Hold") while the current month is still in progress, else ON_HOLD
 *     ("Rolled" - released and under $30);
 *   - id is the unqueued row's `pending-<userId>` id, which is the one
 *     the pay actions understand (payScheduledBalance);
 *   - `unreleasedAmount` is the live (not yet released) part and
 *     `payableAmount` what a pay/export may actually send NOW (a
 *     SCHEDULED row never pays out the unreleased live part; the pay
 *     action recomputes released wallets itself);
 *   - `periodLabel` reads like "Oct 2026 and earlier".
 * Real PayoutRequest rows (REQUESTED/APPROVED/PROCESSING/PAID) are never
 * merged into it: their money is already netted out of the released
 * balance (lib/wallet.ts summarizePayouts), so they are separate facts
 * and nothing is counted twice.
 *
 * SUPERSEDED REJECTIONS. When a payout is rejected its money rolls back
 * into the person's balance, so the ledger also shows an unqueued
 * ON_HOLD/SCHEDULED row carrying that same money — the same account
 * twice with the same figure. A REJECTED row is therefore hidden while
 * the same user has an unqueued row whose total is at least as large
 * (the money is demonstrably still carried by that row). The
 * PayoutRequest itself is untouched in the database.
 */

import { MIN_PAYOUT_AMOUNT } from "./payout-threshold";

export interface LedgerRowLike {
  id: string;
  userId: string;
  status: string;
  paid: boolean;
  requestedAt: string;
  resolvedAt: string | null;
  isAffiliate: boolean;
  reportMonthKey: string;
  bookSalesEarnings: number;
  referralEarnings: number;
  commissionEarnings: number;
  combinedTotal: number;
  componentIds?: string[];
  paidComponentIds?: string[];
  paidAmount?: number;
  /** Only on a merged open-balance row: the part that is the current,
   * still-open month (not released yet, never payable). */
  unreleasedAmount?: number;
  /** Only on a merged SCHEDULED open-balance row: what may be sent now. */
  payableAmount?: number;
  /** Only on a merged open-balance row: e.g. "Oct 2026 and earlier". */
  periodLabel?: string;
}

export type CollapseReason = "identical" | "same-type" | "dual-role" | "open-balance" | "superseded-rejected";

export interface CollapseEvent {
  userId: string;
  period: string;
  ids: string[];
  reason: CollapseReason;
  /** True when this collapse means the underlying data had a genuine
   * duplicate (worth an alert); false for the normal dual-role merge and
   * the superseded-rejection hide. */
  suspicious: boolean;
}

const SYNTHETIC = new Set(["LIVE", "ON_HOLD", "SCHEDULED"]);
const REAL_PRECEDENCE = ["REQUESTED", "APPROVED", "PROCESSING", "PAID", "REJECTED"];
// Payable wins; then the in-progress month keeps the row "On Hold"; the
// plain rolled balance is last.
const SYNTHETIC_PRECEDENCE = ["SCHEDULED", "LIVE", "ON_HOLD"];

function cents(n: number): number {
  return Math.round(n * 100);
}
function money(n: number): number {
  return Math.round(n * 100) / 100;
}

export function isSyntheticLedgerRow(r: Pick<LedgerRowLike, "status">): boolean {
  return SYNTHETIC.has(r.status);
}

export function ledgerPeriodKey(r: Pick<LedgerRowLike, "status" | "reportMonthKey">): string {
  if (r.status === "LIVE") return `live:${r.reportMonthKey}`;
  if (r.status === "ON_HOLD" || r.status === "SCHEDULED") return "unqueued";
  if (r.status === "REJECTED") return `rejected:${r.reportMonthKey}`;
  return `cycle:${r.reportMonthKey}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** Short human text for which period a row covers, shown under the
 * account name so two legitimately different rows for one account (for
 * example the still-open month and an earlier rolled balance) can never
 * be mistaken for a duplicate. */
export function ledgerPeriodLabel(r: Pick<LedgerRowLike, "status" | "reportMonthKey" | "periodLabel">): string {
  if (r.periodLabel) return r.periodLabel;
  if (r.status === "LIVE") return `${monthLabel(r.reportMonthKey)} (this month)`;
  if (r.status === "ON_HOLD" || r.status === "SCHEDULED") return `${monthLabel(r.reportMonthKey)} and earlier`;
  return monthLabel(r.reportMonthKey);
}

/** The real PayoutRequest ids a Mark paid / Reject on this row may act
 * on: every component except those already paid inside a mixed row. */
export function actionableIds(r: Pick<LedgerRowLike, "id" | "componentIds" | "paidComponentIds">): string[] {
  const paid = new Set(r.paidComponentIds ?? []);
  return (r.componentIds ?? [r.id]).filter((id) => !paid.has(id));
}

/** What is still owed on a row: its total minus any part already paid
 * inside a mixed paid/unpaid row. This — never combinedTotal — is what a
 * batch/transfer file or a "selected total" must use, or the paid part
 * would be sent a second time. */
export function outstandingAmount(r: Pick<LedgerRowLike, "combinedTotal" | "paidAmount">): number {
  return money(r.combinedTotal - (r.paidAmount ?? 0));
}

/** The not-yet-released (current month) part of an open-balance row. */
export function unreleasedPortion(r: Pick<LedgerRowLike, "status" | "combinedTotal" | "unreleasedAmount">): number {
  if (r.unreleasedAmount !== undefined) return r.unreleasedAmount;
  return r.status === "LIVE" ? r.combinedTotal : 0;
}

/** The released part of an open-balance row (what is really carried as a
 * rolled/scheduled balance). 0 for a plain LIVE row. */
export function releasedPortion(r: Pick<LedgerRowLike, "status" | "combinedTotal" | "unreleasedAmount">): number {
  return Math.max(0, money(r.combinedTotal - unreleasedPortion(r)));
}

/** What a payout may send NOW for an unpaid row. REQUESTED/APPROVED:
 * what is still owed. SCHEDULED: only each wallet that individually
 * clears the $30 minimum (the same per-wallet test payScheduledBalance
 * applies — author wallet = royalties, affiliate wallet = referral +
 * commission), and never the live month. Anything else: 0. */
export function payableNowAmount(
  r: Pick<LedgerRowLike, "status" | "combinedTotal" | "paidAmount" | "bookSalesEarnings" | "referralEarnings" | "commissionEarnings" | "payableAmount">
): number {
  if (r.payableAmount !== undefined) return r.payableAmount;
  if (r.status === "SCHEDULED") {
    const author = r.bookSalesEarnings;
    const affiliate = r.referralEarnings + r.commissionEarnings;
    return money((cents(author) >= cents(MIN_PAYOUT_AMOUNT) ? author : 0) + (cents(affiliate) >= cents(MIN_PAYOUT_AMOUNT) ? affiliate : 0));
  }
  if (r.status === "REQUESTED" || r.status === "APPROVED") return outstandingAmount(r);
  return 0;
}

function pickStatus(rows: LedgerRowLike[], synthetic: boolean): string {
  const order = synthetic ? SYNTHETIC_PRECEDENCE : REAL_PRECEDENCE;
  for (const s of order) if (rows.some((r) => r.status === s)) return s;
  return rows[0].status;
}

function mergeGroup<T extends LedgerRowLike>(group: T[], period: string, events: CollapseEvent[]): T {
  const synthetic = isSyntheticLedgerRow(group[0]);
  // Synthetic rows have two slots that are ADDED to each other: "L" (the
  // live, still-open month) and "U" (the released-but-unqueued balance).
  // Within a slot, identical amounts are twins and collapse.
  const typeKeyOf = (r: T) => (synthetic ? (r.status === "LIVE" ? "L" : "U") : r.isAffiliate ? "B" : "A");

  const byType = new Map<string, T[]>();
  for (const r of group) {
    const k = typeKeyOf(r);
    const list = byType.get(k);
    if (list) list.push(r);
    else byType.set(k, [r]);
  }

  type Part = { rep: T; members: T[] };
  const parts: Part[] = [];
  let sawTwin = false;
  let sawSplit = false;
  for (const list of byType.values()) {
    const clusters = new Map<number, Part>();
    for (const r of list) {
      const c = clusters.get(cents(r.combinedTotal));
      if (c) {
        c.members.push(r);
        sawTwin = true;
      } else {
        clusters.set(cents(r.combinedTotal), { rep: r, members: [r] });
      }
    }
    if (clusters.size > 1) sawSplit = true;
    parts.push(...clusters.values());
  }

  // The kept row's identity: for an open balance the unqueued
  // `pending-<userId>` row (the id the pay actions understand).
  const base = (synthetic ? group.find((r) => r.status !== "LIVE") : undefined) ?? group[0];
  const status = pickStatus(group, synthetic);
  const everyPaid = group.every((r) => r.status === "PAID");
  const anyPaid = group.some((r) => r.status === "PAID");
  const allResolved = group.every((r) => r.resolvedAt);

  const merged: T = {
    ...base,
    bookSalesEarnings: money(parts.reduce((s, p) => s + p.rep.bookSalesEarnings, 0)),
    referralEarnings: money(parts.reduce((s, p) => s + p.rep.referralEarnings, 0)),
    commissionEarnings: money(parts.reduce((s, p) => s + p.rep.commissionEarnings, 0)),
    combinedTotal: money(parts.reduce((s, p) => s + p.rep.combinedTotal, 0)),
    status,
    paid: everyPaid,
    resolvedAt: allResolved ? group.map((r) => r.resolvedAt as string).sort().slice(-1)[0] : null,
    isAffiliate: group.some((r) => r.isAffiliate) || parts.some((p) => p.rep.referralEarnings + p.rep.commissionEarnings > 0),
  };

  const liveParts = parts.filter((p) => p.rep.status === "LIVE");
  const unqueuedParts = parts.filter((p) => p.rep.status !== "LIVE");
  const bothSlots = synthetic && liveParts.length > 0 && unqueuedParts.length > 0;
  if (bothSlots) {
    merged.unreleasedAmount = money(liveParts.reduce((s, p) => s + p.rep.combinedTotal, 0));
    if (status === "SCHEDULED") merged.payableAmount = money(unqueuedParts.reduce((s, p) => s + payableNowAmount({ ...p.rep, status: "SCHEDULED", payableAmount: undefined }), 0));
    const newest = group.map((r) => r.reportMonthKey).sort().slice(-1)[0];
    merged.periodLabel = `${monthLabel(newest)} and earlier`;
  }

  if (!synthetic) {
    merged.componentIds = [...new Set(group.flatMap((r) => r.componentIds ?? [r.id]))];
    if (anyPaid && !everyPaid) {
      merged.paidComponentIds = group.filter((r) => r.status === "PAID").map((r) => r.id);
      merged.paidAmount = money(parts.filter((p) => p.members.some((m) => m.status === "PAID")).reduce((s, p) => s + p.rep.combinedTotal, 0));
    }
  }

  const ids = group.map((r) => r.id);
  if (sawTwin) events.push({ userId: base.userId, period, ids, reason: "identical", suspicious: true });
  else if (sawSplit) events.push({ userId: base.userId, period, ids, reason: "same-type", suspicious: true });
  else if (bothSlots) events.push({ userId: base.userId, period, ids, reason: "open-balance", suspicious: false });
  else events.push({ userId: base.userId, period, ids, reason: "dual-role", suspicious: synthetic });
  return merged;
}

/** Grouping key: every open-balance (synthetic) row of a user is one
 * group; real rows group by their payout period. */
function groupKeyOf(r: Pick<LedgerRowLike, "status" | "reportMonthKey">): string {
  return isSyntheticLedgerRow(r) ? "open" : ledgerPeriodKey(r);
}

/**
 * Guarantees at most one row per (userId, period) — see the module
 * comment for the rules. Pure: returns the consolidated rows (in order
 * of each group's first appearance, so the live → unqueued → historical
 * most-recent-first ordering of the input is preserved) plus an event
 * per group that had to be collapsed, so the caller can log
 * `suspicious` ones.
 */
export function consolidateLedgerRows<T extends LedgerRowLike>(
  rows: T[],
  opts: { hideSupersededRejected?: boolean } = {}
): { rows: T[]; events: CollapseEvent[] } {
  const hideSuperseded = opts.hideSupersededRejected ?? true;
  const events: CollapseEvent[] = [];

  const groups = new Map<string, T[]>();
  for (const r of rows) {
    const key = `${r.userId}|${groupKeyOf(r)}`;
    const g = groups.get(key);
    if (g) g.push(r);
    else groups.set(key, [r]);
  }

  let out: T[] = [];
  for (const [key, group] of groups) {
    out.push(group.length === 1 ? group[0] : mergeGroup(group, key.slice(key.indexOf("|") + 1), events));
  }

  if (hideSuperseded) {
    const unqueuedByUser = new Map<string, number>();
    for (const r of out) if (isSyntheticLedgerRow(r) && releasedPortion(r) > 0) unqueuedByUser.set(r.userId, cents(releasedPortion(r)));
    out = out.filter((r) => {
      if (r.status !== "REJECTED") return true;
      const carried = unqueuedByUser.get(r.userId);
      if (carried === undefined || carried < cents(r.combinedTotal)) return true;
      events.push({ userId: r.userId, period: ledgerPeriodKey(r), ids: r.componentIds ?? [r.id], reason: "superseded-rejected", suspicious: false });
      return false;
    });
  }

  return { rows: out, events };
}
