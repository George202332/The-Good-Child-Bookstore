"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { BACKEND_ROLES, canViewFinancials } from "@/lib/roles";

/**
 * Real platform analytics — the brief's "Analytics" section (Revenue,
 * Orders, Books Sold, Top Books, Monthly Growth) built entirely from
 * actual SaleLine/Order rows, not simulated data. Financial figures are
 * gated by canViewFinancials() (EDITOR sees volume metrics, not money).
 *
 * revenueBreakdown is the 7-column month-by-month table showing exactly
 * how a given month's revenue splits between the company, authors, and
 * affiliates — the explicit "how much money belongs to whom" view.
 */

export interface RevenueBreakdownRow {
  month: string;
  orders: number;
  booksSold: number;
  grossRevenue: number;
  companyShare: number;
  authorShare: number;
  affiliateShare: number;
}

export interface AnalyticsSummary {
  totalOrders: number;
  totalBooksSold: number;
  totalCompanyRevenue: number | null;
  totalAuthorRevenue: number | null;
  totalAffiliateRevenue: number | null;
  monthlyRevenue: { month: string; amount: number }[];
  topBooks: { title: string; unitsSold: number; revenue: number }[];
  revenueBreakdown: RevenueBreakdownRow[];
}

async function requireBackendAccess() {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !BACKEND_ROLES.includes(role)) throw new Error("Not authorized.");
  return role;
}

export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  const role = await requireBackendAccess();
  const showFinancials = canViewFinancials(role);

  const empty: AnalyticsSummary = {
    totalOrders: 0,
    totalBooksSold: 0,
    totalCompanyRevenue: showFinancials ? 0 : null,
    totalAuthorRevenue: showFinancials ? 0 : null,
    totalAffiliateRevenue: showFinancials ? 0 : null,
    monthlyRevenue: [],
    topBooks: [],
    revenueBreakdown: [],
  };

  try {
    const [orders, saleLines] = await Promise.all([
      prisma.order.findMany({ where: { status: "PAID" }, select: { createdAt: true } }),
      prisma.saleLine.findMany({ include: { book: true }, orderBy: { createdAt: "asc" } }),
    ]);

    const orderList = Array.isArray(orders) ? orders : [];
    const totalOrders = orderList.length;
    const lines = Array.isArray(saleLines) ? saleLines : [];
    const totalBooksSold = lines.length;

    let totalCompanyRevenue: number | null = showFinancials ? 0 : null;
    let totalAuthorRevenue: number | null = showFinancials ? 0 : null;
    let totalAffiliateRevenue: number | null = showFinancials ? 0 : null;
    const monthlyMap = new Map<string, number>();
    const bookMap = new Map<string, { title: string; unitsSold: number; revenue: number }>();
    const breakdownMap = new Map<string, RevenueBreakdownRow>();

    function getMonthRow(monthKey: string): RevenueBreakdownRow {
      let row = breakdownMap.get(monthKey);
      if (!row) {
        row = { month: monthKey, orders: 0, booksSold: 0, grossRevenue: 0, companyShare: 0, authorShare: 0, affiliateShare: 0 };
        breakdownMap.set(monthKey, row);
      }
      return row;
    }

    for (const o of orderList as { createdAt: Date }[]) {
      const monthKey = o.createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      getMonthRow(monthKey).orders += 1;
    }

    for (const l of lines as {
      createdAt: Date;
      grossAmount: unknown;
      companyShare: unknown;
      authorShare: unknown;
      affiliateShare: unknown;
      bookId: string;
      book: { title: string };
    }[]) {
      const monthKey = l.createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      const row = getMonthRow(monthKey);
      row.booksSold += 1;
      row.grossRevenue += Number(l.grossAmount);
      row.companyShare += Number(l.companyShare);
      row.authorShare += Number(l.authorShare);
      row.affiliateShare += Number(l.affiliateShare);

      if (showFinancials) {
        totalCompanyRevenue = (totalCompanyRevenue ?? 0) + Number(l.companyShare);
        totalAuthorRevenue = (totalAuthorRevenue ?? 0) + Number(l.authorShare);
        totalAffiliateRevenue = (totalAffiliateRevenue ?? 0) + Number(l.affiliateShare);
        monthlyMap.set(monthKey, (monthlyMap.get(monthKey) ?? 0) + Number(l.grossAmount));
      }

      const existing = bookMap.get(l.bookId);
      if (existing) {
        existing.unitsSold += 1;
        existing.revenue += Number(l.grossAmount);
      } else {
        bookMap.set(l.bookId, { title: l.book.title, unitsSold: 1, revenue: Number(l.grossAmount) });
      }
    }

    const topBooks = Array.from(bookMap.values())
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, 10);

    return {
      totalOrders,
      totalBooksSold,
      totalCompanyRevenue,
      totalAuthorRevenue,
      totalAffiliateRevenue,
      monthlyRevenue: Array.from(monthlyMap.entries()).map(([month, amount]) => ({ month, amount })),
      topBooks,
      revenueBreakdown: showFinancials ? Array.from(breakdownMap.values()).reverse() : [],
    };
  } catch {
    return empty;
  }
}
