import ExcelJS from "exceljs";
import type { PayoutLedgerRow } from "@/actions/payout-ledger";
import { outstandingAmount } from "@/lib/payout-ledger-dedupe";
import { isWiseBatchEligible } from "@/lib/csv/wise-batch";

/**
 * XLSX counterpart to lib/csv/wise-batch.ts — same column shape, same
 * payout-eligible (Category B "SCHEDULED" + already-queued
 * "REQUESTED"/"APPROVED") scope, same honesty caveat about Wise's real
 * template varying its exact fields by currency/country (see that
 * file's module comment). Offered as a second format alongside CSV
 * since Wise's own upload wizard accepts either.
 */
export async function buildWiseBatchXlsx(rows: PayoutLedgerRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "The Good Child Bookstore";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Wise Batch Payment", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Recipient Name", key: "name", width: 24 },
    { header: "Recipient Email", key: "email", width: 28 },
    { header: "Account / Bank Details", key: "details", width: 36 },
    { header: "Currency", key: "currency", width: 10 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Reference", key: "reference", width: 16 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF33082E" } };
  headerRow.height = 20;

  const eligible = rows.filter(isWiseBatchEligible);
  for (const r of eligible) {
    const row = sheet.addRow({
      name: r.accountHolderName,
      email: r.email,
      details: r.accountDetails,
      currency: r.currency,
      amount: outstandingAmount(r),
      reference: `GCB-${r.id.slice(0, 8).toUpperCase()}`,
    });
    row.getCell("amount").numFmt = '"$"#,##0.00';
  }

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
