import { NextRequest, NextResponse } from "next/server";
import { getPayoutLedger } from "@/actions/payout-ledger";
import { buildWiseBatchCsv } from "@/lib/csv/payout-wise-batch";
import { buildPayoutLedgerPdf } from "@/lib/pdf/payout-ledger";

/**
 * Downloads the full admin payout ledger (see actions/payout-ledger.ts
 * for the ADMIN/ACCOUNTANT-only authorization check it performs
 * itself) as either a Wise-ready bulk-payment CSV (?format=csv, the
 * default) or an internal record-keeping PDF (?format=pdf).
 */
export async function GET(req: NextRequest) {
  const rows = await getPayoutLedger();
  if ("error" in rows) return NextResponse.json({ error: rows.error }, { status: 403 });

  const format = req.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "csv";
  const dateStamp = new Date().toISOString().slice(0, 10);

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

  const csv = buildWiseBatchCsv(rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gcb-payout-batch-${dateStamp}.csv"`,
    },
  });
}
