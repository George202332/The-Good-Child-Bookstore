import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPayoutStatementData } from "@/lib/payout-statement-data";
import { buildPayoutStatementPdf } from "@/lib/pdf/payout-statement";

/**
 * Downloads a single month's payout statement as a PDF, matching the
 * reference statement format exactly (see lib/pdf/payout-statement.ts).
 * ?month=YYYY-MM identifies which month; always the signed-in user's
 * own data — there's no userId param, so nobody can fetch someone
 * else's statement by guessing a URL.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const month = req.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Invalid or missing month (expected YYYY-MM)." }, { status: 400 });
  }

  const data = await getPayoutStatementData(session.user.id, month);
  if (!data) return NextResponse.json({ error: "No data for that month." }, { status: 404 });

  const pdfBytes = await buildPayoutStatementPdf(data);

  return new NextResponse(new Uint8Array(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="gcb-payout-${(session.user.name ?? "author").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${month}.pdf"`,
    },
  });
}
