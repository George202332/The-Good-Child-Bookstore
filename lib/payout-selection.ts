import { actionableIds, payableNowAmount, type LedgerRowLike } from "@/lib/payout-ledger-dedupe";
import { isLedgerRowPayable } from "@/lib/payout-status";

/**
 * Pure selection logic behind the checkboxes on the admin Payout
 * Requests table (app/admin/payouts/PayoutsTable.tsx), kept out of the
 * component so it can be unit-tested (tests/payout-selection.test.ts).
 *
 * SELECTING and PAYING are separate things (Round 26):
 *  - Any row present in the table can be ticked (Pending, Rolled, Live,
 *    Paid, Rejected). A checkbox is never disabled, so it always responds.
 *  - Only a PAYABLE row is acted on by "Mark selected as paid": it reads
 *    "Pending" to the admin (internal SCHEDULED, or a queued REQUESTED /
 *    APPROVED request), is not paid, and has at least one real id left
 *    to act on. The other ticked rows are skipped and counted.
 * The UI is not a security boundary: bulkMarkPayoutsPaid and the pay
 * actions re-check everything on the server and refuse non-payable rows.
 */

type SelectableRow = Pick<
  LedgerRowLike,
  "id" | "status" | "paid" | "combinedTotal" | "paidAmount" | "bookSalesEarnings" | "referralEarnings" | "commissionEarnings" | "payableAmount" | "componentIds" | "paidComponentIds"
>;

/** Whether "Mark as paid" would act on this row. */
export function isRowPayable(r: SelectableRow): boolean {
  return !r.paid && isLedgerRowPayable(r.status) && actionableIds(r).length > 0;
}

/** Short bucket used to summarise skipped rows ("2 Rolled, 1 Live"). */
export function skipCategory(r: SelectableRow): string | null {
  if (isRowPayable(r)) return null;
  if (r.paid || r.status === "PAID") return "Paid";
  switch (r.status) {
    case "LIVE":
      return "Live";
    case "ON_HOLD":
      return "Rolled";
    case "REJECTED":
      return "Rejected";
    default:
      return "Nothing left to pay";
  }
}

/** Why "Mark as paid" would skip a row, or null when it is payable.
 * Shown as the checkbox tooltip suffix for non-payable rows. */
export function skipReason(r: SelectableRow): string | null {
  switch (skipCategory(r)) {
    case null:
      return null;
    case "Paid":
      return "Already paid";
    case "Live":
      return "Live: the current cycle is still open, so this is not payable yet";
    case "Rolled":
      return "Rolled: under the $30 minimum, so it rolls into the next cycle and cannot be paid";
    case "Rejected":
      return "Rejected: this payout was declined";
    default:
      return "Nothing left to pay: every part of this payout is already paid, or it has no payout record to act on";
  }
}

/** Every row in the list can be ticked. */
export function selectableIds(rows: SelectableRow[]): string[] {
  return rows.map((r) => r.id);
}

/** Drop ids that are no longer in `rows` (e.g. after a refresh removed
 * or renamed a row). Returns the SAME set when nothing was dropped, so
 * it is cheap and safe to call on every render. */
export function pruneSelection(selected: ReadonlySet<string>, rows: SelectableRow[]): ReadonlySet<string> {
  const present = new Set(rows.map((r) => r.id));
  let dropped = false;
  for (const id of selected) {
    if (!present.has(id)) {
      dropped = true;
      break;
    }
  }
  if (!dropped) return selected;
  return new Set([...selected].filter((id) => present.has(id)));
}

/** Toggle one row. An id that is not in `rows` can never enter the
 * selection (and is dropped if it was somehow there). */
export function toggleRow(selected: ReadonlySet<string>, rows: SelectableRow[], id: string): Set<string> {
  const next = new Set(selected);
  if (!rows.some((r) => r.id === id)) {
    next.delete(id);
    return next;
  }
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Select-all over the given (usually filtered) rows: when every row in
 * view is already ticked it unticks them, otherwise it ticks them all.
 * Ids outside `rows` (hidden by a filter) are kept as they are. */
export function toggleAll(selected: ReadonlySet<string>, rows: SelectableRow[]): Set<string> {
  const ids = selectableIds(rows);
  const next = new Set(selected);
  const all = ids.length > 0 && ids.every((id) => next.has(id));
  for (const id of ids) {
    if (all) next.delete(id);
    else next.add(id);
  }
  return next;
}

export interface SelectionSummary {
  /** Ticked rows (only rows that exist in the list). */
  count: number;
  /** Of those, rows "Mark as paid" would act on. */
  payableCount: number;
  /** Ticked rows "Mark as paid" would skip. */
  skippedCount: number;
  /** Payable-now total of the PAYABLE ticked rows only. */
  total: number;
  /** Real PayoutRequest ids / synthetic `pending-...` ids of the payable
   * rows only, to send to the pay action. */
  ids: string[];
  /** Row ids (table keys) of the payable ticked rows. */
  payableRowIds: string[];
  /** Skipped rows grouped by reason, e.g. [{ label: "Rolled", count: 2 }]. */
  skipped: { label: string; count: number }[];
  allSelected: boolean;
  someSelected: boolean;
}

/** Counts, payable total and ids for the bulk bar, plus the state of the
 * select-all box (checked / indeterminate) over the visible rows. */
export function summarizeSelection(selected: ReadonlySet<string>, visibleRows: SelectableRow[], allRows: SelectableRow[] = visibleRows): SelectionSummary {
  const picked = allRows.filter((r) => selected.has(r.id));
  const payable = picked.filter(isRowPayable);
  const buckets = new Map<string, number>();
  for (const r of picked) {
    const c = skipCategory(r);
    if (c) buckets.set(c, (buckets.get(c) ?? 0) + 1);
  }
  const visibleIds = selectableIds(visibleRows);
  return {
    count: picked.length,
    payableCount: payable.length,
    skippedCount: picked.length - payable.length,
    total: Math.round(payable.reduce((s, r) => s + payableNowAmount(r), 0) * 100) / 100,
    ids: payable.flatMap((r) => actionableIds(r)),
    payableRowIds: payable.map((r) => r.id),
    skipped: [...buckets].map(([label, count]) => ({ label, count })),
    allSelected: visibleIds.length > 0 && visibleIds.every((id) => selected.has(id)),
    someSelected: visibleIds.some((id) => selected.has(id)),
  };
}

/** "2 Rolled, 1 Live" */
export function describeSkipped(skipped: SelectionSummary["skipped"]): string {
  return skipped.map((s) => `${s.count} ${s.label}`).join(", ");
}
