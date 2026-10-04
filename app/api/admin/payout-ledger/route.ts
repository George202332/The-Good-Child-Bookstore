import { NextRequest, NextResponse } from "next/server";
import { getPayoutLedger } from "@/actions/payout-ledger";
import { buildPayoutBatchCsv } from "@/lib/csv/payout-batch";
import { buildPayoutLedgerPdf } from "@/lib/pdf/payout-ledger";
import { buildPayoutLedgerXlsx } from "@/lib/xlsx/payout-ledger";
import { buildWiseBatchCsv } from "@/lib/csv/wise-batch";
import { buildWiseBatchXlsx } from "@/lib/xlsx/wise-batch";

/**
 * Downloads the full admin payout ledger (see actions/payout-ledger.ts
 * for the ADMIN/ACCOUNTANT-only authorization check it performs
 * itself) as a manual-bulk-payment CSV (?format=csv, the default), an
 * internal record-keeping PDF (?format=pdf), a full Excel workbook
 * (?format=xlsx), or a Wise/Payoneer-manual-bulk-upload-compatible
 * file scoped to payout-eligible rows only (?format=wise-batch for
 * CSV, ?format=wise-batch-xlsx for Excel — see lib/csv/wise-batch.ts
 * for the column shape and its honesty caveat about Wise's real
 * template). None of these formats make any live call to Wise,
 * Payoneer, or any other payment gateway — every one is a plain file
 * download built from the same local getPayoutLedger() data as the
 * others.
 */
export async function GET(req: NextRequest) {
  const rows = await getPayoutLedger();
  if ("error" in rows) return NextResponse.json({ error: rows.error }, { status: 403 });

  const formatParam = req.nextUrl.searchParams.get("format");
  const format =
    formatParam === "pdf" ? "pdf" :
    formatParam === "xlsx" ? "xlsx" :
    formatParam === "wise-batch" ? "wise-batch" :
    formatParam === "wise-batch-xlsx" ? "wise-batch-xlsx" :
    "csv";
  const dateStamp = new Date().toISOString().slice(0, 10);

  if (format === "wise-batch-xlsx") {
    const xlsxBuffer = await buildWiseBatchXlsx(rows);
    return new NextResponse(new Uint8Array(xlsxBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="gcb-wise-batch-${dateStamp}.xlsx"`,
      },
    });
  }

  if (format === "wise-batch") {
    const csv = buildWiseBatchCsv(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="gcb-wise-batch-${dateStamp}.csv"`,
      },
    });
  }

  if (format === "pdf") {
    const pdfBytes = await buildPayoutLedgerPdf(rows);
    return new NextResponse(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="gcb-payout-ledger-${dateStamp}.pdf"`,
      },
    });
  }

  if (format === "xlsx") {
    const xlsxBuffer = await buildPayoutLedgerXlsx(rows);
    return new NextResponse(new Uint8Array(xlsxBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="gcb-payout-ledger-${dateStamp}.xlsx"`,
      },
    });
  }

  const csv = buildPayoutBatchCsv(rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gcb-payout-batch-${dateStamp}.csv"`,
    },
  });
}
