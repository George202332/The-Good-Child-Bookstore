import type { GrowthMonth, RetentionMonth } from "@/lib/investor-metrics";

/**
 * The Investor overview's CSV export (Amendment 12) — matching the
 * existing export conventions in lib/csv/ (plain comma-escaped text,
 * one header row, built from the same real rows the page renders, see
 * app/api/investor/overview/route.ts). Two sections in one file —
 * growth, then retention — separated by a blank line, since both are
 * small, month-keyed tables an investor would want side by side in one
 * download rather than two separate files.
 */
function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function buildInvestorOverviewCsv(growth: GrowthMonth[], retention: RetentionMonth[]): string {
  const growthHeader = ["Month", "Revenue", "Orders", "New Users"];
  const growthLines = growth.map((g) =>
    [g.month, g.revenue.toFixed(2), String(g.orders), String(g.newUsers)].map(csvEscape).join(",")
  );

  const retentionHeader = ["Month", "New Authors", "Active Authors", "New Affiliates", "Active Affiliates"];
  const retentionLines = retention.map((r) =>
    [r.month, String(r.newAuthors), String(r.activeAuthors), String(r.newAffiliates), String(r.activeAffiliates)]
      .map(csvEscape)
      .join(",")
  );

  return [
    "Growth (monthly)",
    growthHeader.join(","),
    ...growthLines,
    "",
    "Author / Affiliate Retention (monthly)",
    retentionHeader.join(","),
    ...retentionLines,
  ].join("\n");
}
