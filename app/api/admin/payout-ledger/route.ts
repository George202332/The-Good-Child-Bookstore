import { NextRequest, NextResponse } from "next/server";
import { getPayoutLedger } from "@/actions/payout-ledger";
import { buildPayoutBatchCsv } from "@/lib/csv/payout-batch";
import { buildPayoutLedgerPdf } from "@/lib/pdf/payout-ledger";
import { buildPayoutLedgerXlsx } from "@/lib/xlsx/payout-ledger";

/**
 * Downloads the payouts that are due to be paid, as ?format=csv (the
 * default), ?format=xlsx or ?format=pdf. All three are built from the
 * same shared table (lib/payout-export.ts: one row per account, bank
 * transfer columns, one combined total), so they always match. Admin,
 * Accountant and Investor may download (getPayoutLedger performs the
 * authorization itself); nothing is ever written, and no call is made
 * to any payment gateway.
 */
export async function GET(req: NextRequest) {
  const rows = await getPayoutLedger();
  if ("error" in rows) return NextResponse.json({ error: rows.error }, { status: 403 });

  const formatParam = req.nextUrl.searchParams.get("format") ?? "csv";
  if (formatParam !== "csv" && formatParam !== "xlsx" && formatParam !== "pdf") {
    return NextResponse.json({ error: "Unknown format. Use csv, xlsx or pdf." }, { status: 400 });
  }
  const dateStamp = new Date().toISOString().slice(0, 10);

  if (formatParam === "pdf") {
    const pdfBytes = await buildPayoutLedgerPdf(rows);
    return new NextResponse(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="gcb-payouts-${dateStamp}.pdf"`,
      },
    });
  }

  if (formatParam === "xlsx") {
    const xlsxBuffer = await buildPayoutLedgerXlsx(rows);
    return new NextResponse(new Uint8Array(xlsxBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="gcb-payouts-${dateStamp}.xlsx"`,
      },
    });
  }

  return new NextResponse(buildPayoutBatchCsv(rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gcb-payouts-${dateStamp}.csv"`,
    },
  });
}
