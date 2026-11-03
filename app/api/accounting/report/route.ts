import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accountingViewer } from "@/lib/accounting/guard";
import { isSnapshot } from "@/lib/accounting/service";
import { buildMonthlyReportPdf } from "@/lib/accounting/report-pdf";
import { isMonthKey } from "@/lib/accounting/period";

export const dynamic = "force-dynamic";

/** Downloads the monthly PDF report of a CLOSED month, built from its locked figures. Admin and Investor only. */
export async function GET(req: NextRequest) {
  if (!(await accountingViewer())) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const month = req.nextUrl.searchParams.get("month");
  if (!isMonthKey(month)) return NextResponse.json({ error: "Invalid month." }, { status: 400 });
  const row = await prisma.accountingMonth.findUnique({ where: { monthKey: month } });
  if (!row || row.status !== "CLOSED" || !isSnapshot(row.snapshot)) return NextResponse.json({ error: "That month is not closed, so it has no report yet." }, { status: 404 });
  const bytes = await buildMonthlyReportPdf({ monthKey: month, snapshot: row.snapshot, version: row.reportVersion, closedAt: (row.closedAt ?? new Date()).toISOString(), closedBy: row.closedByName ?? "Admin" });
  return new NextResponse(new Uint8Array(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="gcb-accounting-${month}${row.reportVersion > 1 ? "-corrected" : ""}.pdf"`, "Cache-Control": "no-store" },
  });
}
