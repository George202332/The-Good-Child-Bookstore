"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { BACKEND_ROLES, canViewFinancials } from "@/lib/roles";

/**
 * Real platform analytics — the brief's "Analytics" section (Revenue,
 * Orders, Books Sold, Top Books, Monthly Growth) built entirely from
 * actual SaleLine/Order rows, not simulated data. Financial figures are
 * gated by canViewFinancials() (EDITOR sees volume metrics, not money).
 */

export interface AnalyticsSummary {
  totalOrders: number;
  totalBooksSold: number;
  totalCompanyRevenue: number | null;
  totalAuthorRevenue: number | null;
  totalAffiliateRevenue: number | null;
  monthlyRevenue: { month: string; amount: number }[];
  topBooks: { title: string; unitsSold: number; revenue: number }[];
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
  };

  try {
    const [totalOrders, saleLines] = await Promise.all([
      prisma.order.count({ where: { status: "PAID" } }),
      prisma.saleLine.findMany({ include: { book: true }, orderBy: { createdAt: "asc" } }),
    ]);

    const lines = Array.isArray(saleLines) ? saleLines : [];
    const totalBooksSold = lines.length;

    let totalCompanyRevenue: number | null = showFinancials ? 0 : null;
    let totalAuthorRevenue: number | null = showFinancials ? 0 : null;
    let totalAffiliateRevenue: number | null = showFinancials ? 0 : null;
    const monthlyMap = new Map<string, number>();
    const bookMap = new Map<string, { title: string; unitsSold: number; revenue: number }>();

    for (const l of lines as {
      createdAt: Date;
      grossAmount: unknown;
      companyShare: unknown;
      authorShare: unknown;
      affiliateShare: unknown;
      bookId: string;
      book: { title: string };
    }[]) {
      if (showFinancials) {
        totalCompanyRevenue = (totalCompanyRevenue ?? 0) + Number(l.companyShare);
        totalAuthorRevenue = (totalAuthorRevenue ?? 0) + Number(l.authorShare);
        totalAffiliateRevenue = (totalAffiliateRevenue ?? 0) + Number(l.affiliateShare);

        const monthKey = l.createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric" });
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
    };
  } catch {
    // Degrade to zeroed-out analytics rather than a 500 if the database
    // is unreachable.
    return empty;
  }
}
