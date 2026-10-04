import type { PayoutLedgerRow } from "@/actions/payout-ledger";

/**
 * Amendment 6 — a Wise-batch-payment-template-compatible file (also
 * usable for a Payoneer-style bulk upload), one row per transfer:
 * recipient name, recipient payout/bank account details, amount,
 * currency. This is a FILE FORMAT export only — no live Wise or
 * Payoneer API call is made anywhere in this app (that integration was
 * fully removed several rounds ago, per explicit instruction, and
 * stays removed); this just produces a downloadable file in the shape
 * Wise's own manual "upload a batch payment file" wizard expects, for
 * an admin to upload there themselves.
 *
 * Scoped to payout-eligible rows only (Category B "SCHEDULED", plus
 * any already-real "REQUESTED"/"APPROVED" PayoutRequest rows) — LIVE
 * (not yet released), ON_HOLD (Category A, still under $30), PAID, and
 * REJECTED rows have no business being in a file meant to drive an
 * actual upcoming bank transfer.
 *
 * HONESTY CHECK on the column shape: Wise's real batch-upload template
 * varies its exact required columns by the recipient's currency/country
 * (an IBAN-based transfer needs different fields than a SWIFT/routing-
 * number one), and this app only stores each recipient's own details as
 * one already-flattened string (lib/payout-method-label.ts's
 * formatAccountDetails — e.g. "iban: GB29NWBK..., legalType: PRIVATE"),
 * not as Wise's own discrete per-field columns. So this build uses the
 * standard columns every Wise batch template shares (recipient name,
 * email, currency, amount, reference) plus ONE combined "Account /
 * Bank Details" column carrying whatever's on file for that recipient
 * — this is a reasonable, genuinely useful approximation, NOT a
 * guaranteed drop-in match for Wise's current upload wizard. Flagged
 * here and in the report rather than presented as exact.
 */
function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function isWiseBatchEligible(r: PayoutLedgerRow): boolean {
  return r.status === "SCHEDULED" || r.status === "REQUESTED" || r.status === "APPROVED";
}

export function buildWiseBatchCsv(rows: PayoutLedgerRow[]): string {
  const header = ["Recipient Name", "Recipient Email", "Account / Bank Details", "Currency", "Amount", "Reference"];
  const eligible = rows.filter(isWiseBatchEligible);
  const lines = eligible.map((r) =>
    [
      r.accountHolderName,
      r.email,
      r.accountDetails,
      r.currency,
      r.combinedTotal.toFixed(2),
      `GCB-${r.id.slice(0, 8).toUpperCase()}`,
    ]
      .map(csvEscape)
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}
