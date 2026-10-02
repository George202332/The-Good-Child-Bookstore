import ExcelJS from "exceljs";
import type { PayoutLedgerRow } from "@/actions/payout-ledger";

/**
 * Excel (.xlsx) export of the admin payout ledger — item 14's "add
 * Excel export alongside the existing CSV/PDF" request. Contains the
 * same rows and the same real, live-computed data as the CSV
 * (lib/csv/payout-batch.ts, manual-bulk-payment format, owed-only) and
 * the PDF (lib/pdf/payout-ledger.ts, full record, every status) —
 * this sheet instead covers every payout row with every figure broken
 * out (book sales / referral / commission / combined), formatted as a
 * real spreadsheet with header styling and column widths rather than a
 * flat text dump, since unlike CSV it doesn't have to stay
 * plain-text-only to be universally readable.
 *
 * Uses `exceljs` (added to package.json — run `npm install` after
 * pulling this change) rather than `xlsx`/`sheetjs`: it's actively
 * maintained, has no known supply-chain history, and writes a real
 * `.xlsx` (styles, column widths, frozen header) directly from a
 * Next.js API route without needing a DOM or browser APIs.
 */
export async function buildPayoutLedgerXlsx(rows: PayoutLedgerRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "The Good Child Bookstore";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Payout Ledger", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = [
    { header: "Account #", key: "accountNumber", width: 16 },
    { header: "Account Holder", key: "accountHolderName", width: 24 },
    { header: "Email", key: "email", width: 28 },
    { header: "Role", key: "role", width: 12 },
    { header: "Payment Method", key: "paymentMethod", width: 16 },
    { header: "Account / Payment Details", key: "accountDetails", width: 28 },
    { header: "Currency", key: "currency", width: 10 },
    { header: "Book Sales Earnings", key: "bookSalesEarnings", width: 18 },
    { header: "Referral Earnings", key: "referralEarnings", width: 16 },
    { header: "Commission Earnings", key: "commissionEarnings", width: 18 },
    { header: "Combined Total", key: "combinedTotal", width: 16 },
    { header: "Status", key: "status", width: 12 },
    { header: "Report Month", key: "reportMonthKey", width: 14 },
    { header: "Requested", key: "requestedAt", width: 14 },
    { header: "Resolved", key: "resolvedAt", width: 14 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF33082E" } };
  headerRow.height = 20;

  const moneyCols = new Set(["bookSalesEarnings", "referralEarnings", "commissionEarnings", "combinedTotal"]);

  for (const r of rows) {
    const row = sheet.addRow({
      accountNumber: r.accountNumber,
      accountHolderName: r.accountHolderName,
      email: r.email,
      role: r.role,
      paymentMethod: r.paymentMethod,
      accountDetails: r.accountDetails,
      currency: r.currency,
      bookSalesEarnings: r.bookSalesEarnings,
      referralEarnings: r.referralEarnings,
      commissionEarnings: r.commissionEarnings,
      combinedTotal: r.combinedTotal,
      status: r.status === "LIVE" ? "Live" : r.paid ? "Paid" : r.status === "REJECTED" ? "Rejected" : "Pending",
      reportMonthKey: r.reportMonthKey,
      requestedAt: r.status === "LIVE" ? "This month" : new Date(r.requestedAt).toLocaleDateString("en-US"),
      resolvedAt: r.resolvedAt ? new Date(r.resolvedAt).toLocaleDateString("en-US") : "",
    });
    row.eachCell((cell, colNumber) => {
      const key = sheet.columns[colNumber - 1]?.key as string | undefined;
      if (key && moneyCols.has(key)) cell.numFmt = '"$"#,##0.00';
    });
  }

  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: sheet.columns.length } };

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
