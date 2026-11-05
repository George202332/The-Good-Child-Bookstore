import { NextResponse } from "next/server";
import { analyticsViewer } from "@/lib/analytics/guard";
import { buildWebAnalyticsReport, reportToCsv } from "@/lib/analytics/report";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const who = await analyticsViewer();
  if (!who) return new NextResponse("Not allowed.", { status: 403 });
  const r = await buildWebAnalyticsReport(new URL(req.url).searchParams.get("month"), who);
  return new NextResponse(reportToCsv(r), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="website-analytics-${r.month}.csv"`, "Cache-Control": "no-store" } });
}
