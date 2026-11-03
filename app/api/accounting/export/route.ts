import { NextRequest, NextResponse } from "next/server";
import { accountingViewer } from "@/lib/accounting/guard";
import { buildAccountingView, buildDrill } from "@/lib/accounting/service";
import { buildExportTable, toCsv, EXPORT_TABLES, type ExportTableName } from "@/lib/accounting/exports";
import { buildTablePdf } from "@/lib/accounting/table-pdf";
import { isMonthKey } from "@/lib/accounting/period";
import type { Metric } from "@/lib/accounting/calc";

export const dynamic = "force-dynamic";

/** Downloads an Accounting list or ledger as CSV or PDF. Admin and Investor only (read-only). */
export async function GET(req: NextRequest) {
  if (!(await accountingViewer())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const table = sp.get("table") as ExportTableName | null;
  if (!table || !EXPORT_TABLES.includes(table)) return NextResponse.json({ error: "Unknown table." }, { status: 400 });
  const format = sp.get("format") === "pdf" ? "pdf" : "csv";
  const selectionRaw = sp.get("selection") ?? "lifetime";
  const selection = selectionRaw === "lifetime" || isMonthKey(selectionRaw) ? selectionRaw : "lifetime";
  const includeTest = sp.get("includeTest") !== "0";
  const view = await buildAccountingView(selection, includeTest);
  const drill = table === "drill" ? await buildDrill(selection, (sp.get("metric") ?? "") as Metric, includeTest) : null;
  const t = buildExportTable(table, view, drill);
  if (!t) return NextResponse.json({ error: "Nothing to export." }, { status: 400 });
  const name = t.filename.replace(/[^a-z0-9._-]+/gi, "-");
  if (format === "pdf") {
    const bytes = await buildTablePdf(t);
    return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"`, "Cache-Control": "no-store" } });
  }
  return new NextResponse(`﻿${toCsv(t)}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}.csv"`, "Cache-Control": "no-store" } });
}
