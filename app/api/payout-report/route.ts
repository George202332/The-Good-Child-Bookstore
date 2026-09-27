import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { authAdmin } from "@/lib/auth-admin";
import { prisma } from "@/lib/prisma";
import { getPayoutStatementData } from "@/lib/payout-statement-data";
import { buildPayoutStatementPdf } from "@/lib/pdf/payout-statement";

/**
 * Downloads a single month's payout statement as a PDF, matching the
 * reference statement format exactly (see lib/pdf/payout-statement.ts).
 * ?month=YYYY-MM identifies which month; defaults to the signed-in
 * reader/author/affiliate's own data. An Admin or Accountant (signed in
 * through the separate backend session — see lib/auth-admin.ts) may
 * instead pass ?userId= to pull a SPECIFIC other account's statement —
 * this is what powers the "Report" download button on the admin Payout
 * Requests ledger, which reuses this exact same report rather than
 * building a second one. Anyone else passing a userId is ignored and
 * gets their own data.
 */
export async function GET(req: NextRequest) {
  const [publicSession, adminSession] = await Promise.all([auth(), authAdmin()]);
  const session = publicSession ?? adminSession;
  if (!session?.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const month = req.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Invalid or missing month (expected YYYY-MM)." }, { status: 400 });
  }

  let targetUserId = session.user.id;
  const requestedUserId = req.nextUrl.searchParams.get("userId");
  if (requestedUserId && requestedUserId !== session.user.id) {
    const role = adminSession?.user?.role;
    if (role !== "ADMIN" && role !== "ACCOUNTANT") {
      return NextResponse.json({ error: "Not authorized to view another account's payout report." }, { status: 403 });
    }
    targetUserId = requestedUserId;
  }

  const data = await getPayoutStatementData(targetUserId, month);
  if (!data) return NextResponse.json({ error: "No data for that month." }, { status: 404 });

  const targetUser = targetUserId === session.user.id ? session.user : await prisma.user.findUnique({ where: { id: targetUserId } });

  const pdfBytes = await buildPayoutStatementPdf(data);

  return new NextResponse(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="gcb-payout-${(targetUser?.name ?? "author").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${month}.pdf"`,
    },
  });
}
