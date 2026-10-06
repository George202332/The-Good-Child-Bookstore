import type { PayoutLedgerRow } from "@/actions/payout-ledger";
import { payableNowAmount } from "@/lib/payout-ledger-dedupe";
import { isLedgerRowPayable } from "@/lib/payout-status";
import { MIN_PAYOUT_AMOUNT } from "@/lib/payout-threshold";

/**
 * THE one definition of the payout export (CSV, Excel and PDF all call
 * buildPayoutExportTable, so the three can never diverge).
 *
 * WHICH ROWS. Only payouts that are due to be paid right now: released,
 * at least $30 and not paid. Concretely a consolidated ledger row (ONE
 * per account, see lib/payout-ledger-dedupe.ts) that is
 *   - Scheduled (released and payable, not queued yet), or
 *   - Queued (a real REQUESTED / APPROVED payout awaiting the transfer),
 * and whose amount payable now (payableNowAmount) is at least
 * MIN_PAYOUT_AMOUNT. Rolled (released, under $30), On Hold / Live (not
 * released), Paid, Rejected and legacy Processing rows are excluded.
 * The amount is what may actually be sent now: for a Scheduled row only
 * each wallet that individually clears $30, never the unreleased current
 * month, and for a partly paid row only the part still owed.
 *
 * COLUMNS. Bank transfer only (no PayPal / M-Pesa columns) and one
 * combined total: no royalties / affiliate / status / requested
 * columns. Bank fields come from the account's default payout recipient
 * (lib/recipient-bank-details.ts) and are blank when not on file.
 */

export const PAYOUT_EXPORT_HEADERS = [
  "Account ID",
  "Account Name",
  "Email",
  "Bank Name",
  "Account Holder Name",
  "Account Number",
  "SWIFT Code / Routing Number",
  "Country",
  "Currency",
  "Total Amount to Be Paid",
] as const;

export interface PayoutExportRow {
  accountId: string;
  accountName: string;
  email: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  swiftOrRouting: string;
  country: string;
  currency: string;
  /** The single combined amount to pay, in the row's currency. */
  total: number;
}

export function isPayoutDueForExport(r: PayoutLedgerRow): boolean {
  if (r.paid) return false;
  if (!(isLedgerRowPayable(r.status) || r.status === "APPROVED")) return false;
  return Math.round(payableNowAmount(r) * 100) >= Math.round(MIN_PAYOUT_AMOUNT * 100);
}

export function buildPayoutExportRows(rows: PayoutLedgerRow[]): PayoutExportRow[] {
  return rows.filter(isPayoutDueForExport).map((r) => ({
    accountId: r.accountNumber,
    accountName: r.userName,
    email: r.email,
    bankName: r.bank.bankName,
    accountHolder: r.bank.accountHolder,
    accountNumber: r.bank.accountNumber,
    swiftOrRouting: r.bank.swiftOrRouting,
    country: r.bank.country,
    currency: r.currency,
    total: payableNowAmount(r),
  }));
}

export interface PayoutExportTable {
  headers: readonly string[];
  /** Text cells in header order; the last cell is the amount as "0.00". */
  body: string[][];
  rows: PayoutExportRow[];
  /** Sum of every row's total (shown in the PDF footer; never a CSV/Excel row). */
  grandTotal: number;
}

export function buildPayoutExportTable(ledger: PayoutLedgerRow[]): PayoutExportTable {
  const rows = buildPayoutExportRows(ledger);
  return {
    headers: PAYOUT_EXPORT_HEADERS,
    rows,
    body: rows.map((r) => [r.accountId, r.accountName, r.email, r.bankName, r.accountHolder, r.accountNumber, r.swiftOrRouting, r.country, r.currency, r.total.toFixed(2)]),
    grandTotal: Math.round(rows.reduce((s, r) => s + r.total, 0) * 100) / 100,
  };
}
