import { NextResponse } from "next/server";
import { authAdmin } from "@/lib/auth-admin";
import { getInvestorOverview } from "@/lib/investor-metrics";
import { buildInvestorOverviewCsv } from "@/lib/csv/investor-overview";

/** Downloads the Investor overview's growth + retention tables as a
 * CSV (Amendment 12's "simple export option") — gated the same way
 * every page under app/investor/** is: INVESTOR or ADMIN only. */
export async function GET() {
  const session = await authAdmin();
  const role = session?.user?.role;
  if (!session?.user || (role !== "INVESTOR" && role !== "ADMIN")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const { growth, retention } = await getInvestorOverview();
  const csv = buildInvestorOverviewCsv(growth, retention);
  const dateStamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gcb-investor-overview-${dateStamp}.csv"`,
    },
  });
}
