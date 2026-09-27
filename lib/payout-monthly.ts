import { prisma } from "@/lib/prisma";
import { fetchEarningsBreakdown } from "@/lib/earnings-lines";

/**
 * The real monthly payout ledger — one row per calendar month that has
 * ever had earnings, whichever combination of organic book sales,
 * author-referral commissions (5% of a referred author's company
 * revenue), and promotion commissions (10% direct-link affiliate share)
 * apply to this particular user. Matches the reference statement
 * format, but with "Affiliate revenue" split into its two real,
 * separately-tracked components instead of one combined column.
 */

export interface MonthlyPayoutRow {
  monthLabel: string;
  monthKey: string; // "2026-01", used as the PDF report's route param
  amount: number;
  unitsSold: number;
  organicRevenue: number;
  referralRevenue: number;
  promotionRevenue: number;
  payoutDate: Date;
  // "Live" — the current, still-open calendar month: the row is always
  // present and its totals keep growing as sales land, rather than only
  // appearing once the month closes. The moment the calendar rolls over,
  // this same row (recomputed fresh from real sale data every time the
  // page loads, so there's nothing to migrate) becomes "Pending payout"
  // for the now-closed month, and a brand new "Live" row appears for the
  // new current month — a rolling pattern with no stored per-row state.
  status: "Live" | "Paid" | "Pending payout";
}

function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabelOf(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** The calendar month immediately before "now". */
function previousMonthRange(now: Date): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start, end };
}
function currentMonthRange(now: Date): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

export async function computeMonthlyPayoutRows(userId: string): Promise<MonthlyPayoutRow[]> {
  // Same shared fetch used by actions/wallet.ts, lib/compute-wallet-for-user.ts,
  // and actions/payout-ledger.ts — see lib/earnings-lines.ts.
  const { organic, referral, commission: promotion } = await fetchEarningsBreakdown(userId);
  const now = new Date();
  const currentKey = monthKeyOf(now);

  const months = new Map<string, { year: number; month: number; organic: number; referral: number; promotion: number; units: number }>();
  function bucket(d: Date) {
    const key = monthKeyOf(d);
    if (!months.has(key)) months.set(key, { year: d.getFullYear(), month: d.getMonth(), organic: 0, referral: 0, promotion: 0, units: 0 });
    return months.get(key)!;
  }
  organic.forEach((l) => { const b = bucket(l.createdAt); b.organic += l.amount; b.units += 1; });
  referral.forEach((l) => { bucket(l.createdAt).referral += l.amount; });
  promotion.forEach((l) => { bucket(l.createdAt).promotion += l.amount; });

  // The current, still-open month always gets a row — even with zero
  // sales so far today — so it's visible and "Live" from day one of the
  // month, then keeps growing in place as sales land, rather than only
  // showing up once the month closes.
  bucket(now);

  const payoutRequests = await prisma.payoutRequest.findMany({ where: { userId } });

  const rows: MonthlyPayoutRow[] = Array.from(months.entries())
    .map(([key, b]) => {
      const payoutDate = new Date(b.year, b.month + 1, 15);
      let status: MonthlyPayoutRow["status"];
      if (key === currentKey) {
        status = "Live";
      } else {
        const payoutMonthKey = monthKeyOf(payoutDate);
        const matchingPayout = payoutRequests.find((p: { requestedAt: Date; status: string }) => monthKeyOf(p.requestedAt) === payoutMonthKey);
        status = matchingPayout?.status === "PAID" ? "Paid" : "Pending payout";
      }
      return {
        monthLabel: monthLabelOf(b.year, b.month),
        monthKey: key,
        amount: b.organic + b.referral + b.promotion,
        unitsSold: b.units,
        organicRevenue: b.organic,
        referralRevenue: b.referral,
        promotionRevenue: b.promotion,
        payoutDate,
        status,
      };
    })
    // Most recent month first — the live, still-accruing row is the one
    // that matters most day to day, so it leads the table.
    .sort((a, b) => (a.monthKey < b.monthKey ? 1 : -1));

  return rows;
}

export interface PayoutStatCards {
  lifetimePayout: number;
  lastMonth: number;
  nextMonth: number;
  pendingPayout: number;
  pendingStatus: "Pending" | "Paid";
}

export async function computePayoutStatCards(userId: string): Promise<PayoutStatCards> {
  const { organic, referral, commission } = await fetchEarningsBreakdown(userId);
  const all = [...organic, ...referral, ...commission];
  const now = new Date();

  const payoutRequests = await prisma.payoutRequest.findMany({ where: { userId } });
  const lifetimePayout = payoutRequests
    .filter((p: { status: string }) => p.status === "PAID")
    .reduce((sum: number, p: { amount: unknown }) => sum + Number(p.amount), 0);

  const { start: lastMonthStart, end: lastMonthEnd } = previousMonthRange(now);
  // "Last Month" — the payout actually disbursed on the 15th of last
  // calendar month (a settled historical figure, not a live total).
  const lastMonthPayout = payoutRequests
    .filter((p: { requestedAt: Date; status: string }) => p.requestedAt >= lastMonthStart && p.requestedAt < lastMonthEnd && p.status === "PAID")
    .reduce((sum: number, p: { amount: unknown }) => sum + Number(p.amount), 0);

  // "Next Month" — the current, still-accruing month's total so far;
  // keeps growing as more sales land, same as the reference described.
  const { start: curStart, end: curEnd } = currentMonthRange(now);
  const nextMonth = all
    .filter((l) => l.createdAt >= curStart && l.createdAt < curEnd)
    .reduce((sum, l) => sum + l.amount, 0);

  // "Pending Payout" — last month's now-closed total, due on the 15th
  // of THIS month. Once the cron has actually created this month's
  // PayoutRequest, prefer its real amount/status over the live
  // recomputation (so a manually-adjusted or already-paid figure wins).
  const thisMonthPayout = payoutRequests.find(
    (p: { requestedAt: Date }) => p.requestedAt >= curStart && p.requestedAt < curEnd
  );
  let pendingPayout: number;
  let pendingStatus: "Pending" | "Paid";
  if (thisMonthPayout) {
    pendingPayout = Number(thisMonthPayout.amount);
    pendingStatus = thisMonthPayout.status === "PAID" ? "Paid" : "Pending";
  } else {
    pendingPayout = all
      .filter((l) => l.createdAt >= lastMonthStart && l.createdAt < lastMonthEnd)
      .reduce((sum, l) => sum + l.amount, 0);
    pendingStatus = "Pending";
  }

  return { lifetimePayout, lastMonth: lastMonthPayout, nextMonth, pendingPayout, pendingStatus };
}
