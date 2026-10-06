import type { PayoutLedgerRow } from "@/actions/payout-ledger";
import { buildPayoutExportTable } from "@/lib/payout-export";

/**
 * The payout CSV: the shared bank-transfer export table (see
 * lib/payout-export.ts for the rows included and the columns). Excel and
 * PDF are built from the very same table.
 */
function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildPayoutBatchCsv(rows: PayoutLedgerRow[]): string {
  const { headers, body } = buildPayoutExportTable(rows);
  return [headers.join(","), ...body.map((cells) => cells.map(csvEscape).join(","))].join("\n");
}
