import type { PayoutLedgerRow } from "@/actions/payout-ledger";

/**
 * A manual-bulk-payment CSV covering the 5 fields George asked for by
 * name — recipient name, account details, currency, amount, reference
 * — for the admin to work from when sending that month's payouts
 * manually through whichever payment method each recipient actually
 * uses (PayPal, bank transfer, or M-Pesa). Provider-agnostic: this
 * isn't tied to any particular payment gateway's own template format.
 * Only rows that are still owed (status other than PAID or REJECTED)
 * are included — a CSV meant to drive real bulk payments has no reason
 * to include payouts already settled or turned down.
 */
function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildPayoutBatchCsv(rows: PayoutLedgerRow[]): string {
  const header = ["Recipient Name", "Account Details", "Currency", "Amount", "Reference"];
  const owed = rows.filter((r) => r.status !== "PAID" && r.status !== "REJECTED");
  const lines = owed.map((r) =>
    [
      r.accountHolderName,
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
