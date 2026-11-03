import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accountingAdmin } from "@/lib/accounting/guard";
import { loadAccountingSource } from "@/lib/accounting/data";
import { buildSnapshot, buildYearSnapshot, isSnapshot } from "@/lib/accounting/service";
import { buildMonthlyReportPdf } from "@/lib/accounting/report-pdf";
import { isMonthKey, monthKeyOf, monthLabel } from "@/lib/accounting/period";

export const dynamic = "force-dynamic";

const pdfResponse = (bytes: Uint8Array, fileName: string) =>
  new NextResponse(new Uint8Array(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${fileName}"`, "Cache-Control": "no-store" },
  });

/**
 * Accounting reports as PDF. ADMIN ONLY (investors can view the tab but cannot download anything).
 *   ?id=<saved report>   a report that was emailed at month close (from the Reports list), exactly as it was sent.
 *   ?month=YYYY-MM       made on the spot. A closed month uses its locked figures; an open month uses the current figures and is
 *                        marked "Draft, Month Not Closed".
 *   ?year=YYYY           made on the spot for the whole year. Marked as a draft unless every month of it is closed.
 *   &includeTest=0|1     whether test-money orders are included (open periods only; a closed month keeps its own setting).
 */
export async function GET(req: NextRequest) {
  if (!(await accountingAdmin())) return NextResponse.json({ error: "Only an Admin can download reports." }, { status: 403 });
  const sp = req.nextUrl.searchParams;

  const id = sp.get("id");
  if (id) {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return NextResponse.json({ error: "Invalid report." }, { status: 400 });
    const saved = await prisma.accountingReport.findUnique({ where: { id } });
    if (!saved) return NextResponse.json({ error: "That report no longer exists." }, { status: 404 });
    return pdfResponse(new Uint8Array(saved.data), saved.fileName.replace(/[^A-Za-z0-9._-]+/g, "-"));
  }

  const includeTest = sp.get("includeTest") !== "0";
  const month = sp.get("month");
  const year = sp.get("year");

  if (isMonthKey(month)) {
    if (month > monthKeyOf(new Date())) return NextResponse.json({ error: "That month has not started yet." }, { status: 400 });
    const row = await prisma.accountingMonth.findUnique({ where: { monthKey: month } });
    if (row?.status === "CLOSED" && isSnapshot(row.snapshot)) {
      const testData = row.snapshot.testData ?? (row.snapshot.includeTest && row.snapshot.testOrders > 0);
      const bytes = await buildMonthlyReportPdf({ monthKey: month, snapshot: row.snapshot, version: row.reportVersion, closedAt: (row.closedAt ?? new Date()).toISOString(), closedBy: row.closedByName ?? "Admin", testData });
      return pdfResponse(bytes, `gcb-accounting-${month}${row.reportVersion > 1 ? "-corrected" : ""}${testData ? "-test-data" : ""}.pdf`);
    }
    const src = await loadAccountingSource();
    const snapshot = await buildSnapshot(src, month, includeTest);
    const bytes = await buildMonthlyReportPdf({ monthKey: month, snapshot, version: 0, closedAt: null, closedBy: null, draft: true, testData: !!snapshot.testData });
    return pdfResponse(bytes, `gcb-accounting-${month}-DRAFT${snapshot.testData ? "-test-data" : ""}.pdf`);
  }

  if (year && /^\d{4}$/.test(year)) {
    const y = Number(year);
    if (y < 2000 || y > Number(monthKeyOf(new Date()).slice(0, 4))) return NextResponse.json({ error: "Invalid year." }, { status: 400 });
    const src = await loadAccountingSource();
    const { snapshot, allClosed } = await buildYearSnapshot(src, y, includeTest);
    const bytes = await buildMonthlyReportPdf({
      monthKey: `${year}-01`, snapshot, version: 1, closedAt: allClosed ? new Date().toISOString() : null, closedBy: allClosed ? "Admin" : null,
      draft: !allClosed, draftLabel: "Draft, Not All Months Closed", testData: !!snapshot.testData, period: { kind: "year", label: year },
    });
    return pdfResponse(bytes, `gcb-accounting-${year}${allClosed ? "" : "-DRAFT"}${snapshot.testData ? "-test-data" : ""}.pdf`);
  }

  return NextResponse.json({ error: `Choose a month (like ${monthLabel("2026-01")}) or a year.` }, { status: 400 });
}
