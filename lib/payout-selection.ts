import { actionableIds, payableNowAmount, type LedgerRowLike } from "@/lib/payout-ledger-dedupe";
import { isLedgerRowPayable } from "@/lib/payout-status";

/**
 * Pure selection logic behind the checkboxes on the admin Payout
 * Requests table (app/admin/payouts/PayoutsTable.tsx), kept out of the
 * component so it can be unit-tested (tests/payout-selection.test.ts).
 *
 * A row is SELECTABLE when it can really be marked paid: it reads
 * "Pending" to the admin (internal SCHEDULED, or a queued REQUESTED /
 * APPROVED request), is not paid, and has at least one real id to act
 * on. Rolled and Live rows are under the $30 minimum or not released
 * yet, Paid is done and Rejected is closed, so those can never be
 * paid and stay disabled, each with a tooltip saying why.
 */

type SelectableRow = Pick<
  LedgerRowLike,
  "id" | "status" | "paid" | "combinedTotal" | "paidAmount" | "bookSalesEarnings" | "referralEarnings" | "commissionEarnings" | "payableAmount" | "componentIds" | "paidComponentIds"
>;

export function isRowSelectable(r: SelectableRow): boolean {
  return !r.paid && isLedgerRowPayable(r.status) && actionableIds(r).length > 0;
}

/** Why a row cannot be ticked, or null when it can. Shown as the
 * checkbox tooltip. */
export function unselectableReason(r: SelectableRow): string | null {
  if (isRowSelectable(r)) return null;
  if (r.paid || r.status === "PAID") return "Already paid";
  switch (r.status) {
    case "LIVE":
      return "Live: the current cycle is still open, so this is not payable yet";
    case "ON_HOLD":
      return "Rolled: under the $30 minimum, so it rolls into the next cycle and cannot be paid";
    case "REJECTED":
      return "Rejected: this payout was declined";
    default:
      return "Not payable: only Pending payouts can be marked as paid";
  }
}

export function selectableIds(rows: SelectableRow[]): string[] {
  return rows.filter(isRowSelectable).map((r) => r.id);
}

/** Toggle one row. Rows that are not selectable are ignored, so a stale
 * or forged id can never enter the selection. */
export function toggleRow(selected: ReadonlySet<string>, rows: SelectableRow[], id: string): Set<string> {
  const next = new Set(selected);
  const row = rows.find((r) => r.id === id);
  if (!row || !isRowSelectable(row)) {
    next.delete(id);
    return next;
  }
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Select-all over the given (usually filtered) rows: when every
 * selectable row is already selected it deselects them, otherwise it
 * selects them all. Ids outside `rows` (other filters) are kept. */
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
  count: number;
  total: number;
  /** Real PayoutRequest ids / synthetic `pending-...` ids to send to the pay action. */
  ids: string[];
  allSelected: boolean;
  someSelected: boolean;
}

/** Count, payable-now total and ids for the bulk bar, plus the state of
 * the select-all box (checked / indeterminate). */
export function summarizeSelection(selected: ReadonlySet<string>, visibleRows: SelectableRow[], allRows: SelectableRow[] = visibleRows): SelectionSummary {
  const picked = allRows.filter((r) => selected.has(r.id) && isRowSelectable(r));
  const visibleIds = selectableIds(visibleRows);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id));
  return {
    count: picked.length,
    total: Math.round(picked.reduce((s, r) => s + payableNowAmount(r), 0) * 100) / 100,
    ids: picked.flatMap((r) => actionableIds(r)),
    allSelected,
    someSelected: visibleIds.some((id) => selected.has(id)),
  };
}
