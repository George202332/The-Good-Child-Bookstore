import ExcelJS from "exceljs";
import type { PayoutLedgerRow } from "@/actions/payout-ledger";
import { buildPayoutExportTable } from "@/lib/payout-export";

/**
 * The payout Excel (.xlsx): the shared bank-transfer export table (see
 * lib/payout-export.ts), identical in rows and columns to the CSV and
 * PDF. Uses `exceljs`. Account and bank numbers are written as text so
 * Excel never reformats leading zeros or long numbers.
 */
export async function buildPayoutLedgerXlsx(rows: PayoutLedgerRow[]): Promise<Buffer> {
  const { headers, rows: exportRows } = buildPayoutExportTable(rows);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "The Good Child Bookstore";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Payouts", { views: [{ state: "frozen", ySplit: 1 }] });
  const widths = [14, 24, 28, 24, 26, 22, 24, 16, 10, 22];
  sheet.columns = headers.map((header, i) => ({ header, key: `c${i}`, width: widths[i] ?? 18 }));

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF33082E" } };
  headerRow.height = 20;

  for (const r of exportRows) {
    const row = sheet.addRow([r.accountId, r.accountName, r.email, r.bankName, r.accountHolder, r.accountNumber, r.swiftOrRouting, r.country, r.currency, r.total]);
    row.getCell(10).numFmt = "#,##0.00";
    for (const c of [1, 6, 7]) row.getCell(c).numFmt = "@";
  }

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
