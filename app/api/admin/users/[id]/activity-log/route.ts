import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authEither } from "@/lib/auth-either";
import { ACTIVITY_LOG_EXPORT_CAP, activityLogFilename, buildUserActivityLogCsv } from "@/lib/csv/user-activity-log";

/**
 * Admin-only CSV download of one user's full activity log (everything
 * lib/audit-log.ts recorded for that account), newest first, capped at
 * ACTIVITY_LOG_EXPORT_CAP rows. Not limited to the 200 rows the on-screen
 * list shows. Only ADMIN accounts may call it.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await authEither();
  if (!session?.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Only Admins can download activity logs." }, { status: 403 });

  const { id } = await params;
  const user = await prisma.user.findUnique({ where: { id }, select: { accountNumber: true } });
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const rows = await prisma.auditLog.findMany({
    where: { actorId: id },
    orderBy: { createdAt: "desc" },
    take: ACTIVITY_LOG_EXPORT_CAP,
    select: { id: true, action: true, createdAt: true, metadata: true },
  });

  const csv = buildUserActivityLogCsv(rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${activityLogFilename(user.accountNumber)}"`,
      "Cache-Control": "no-store",
    },
  });
}
