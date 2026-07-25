"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/** Real per-author analytics — sales, revenue, and a month-by-month
 * breakdown of their own books' performance, distinct from the
 * platform-wide /admin/analytics. */

export interface AuthorAnalyticsSummary {
  totalSales: number;
  totalRevenue: number;
  totalDownloads: number;
  monthlyRevenue: { month: string; amount: number; units: number }[];
  topBooks: { title: string; unitsSold: number; revenue: number }[];
}

const EMPTY: AuthorAnalyticsSummary = { totalSales: 0, totalRevenue: 0, totalDownloads: 0, monthlyRevenue: [], topBooks: [] };

export async function getAuthorAnalytics(): Promise<AuthorAnalyticsSummary> {
  const session = await auth();
  if (session?.user?.role !== "AUTHOR") return EMPTY;

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { authorProfile: { include: { books: { include: { saleLines: true } } } } },
    });
    const books = user?.authorProfile?.books ?? [];
    const lines = books.flatMap((b: { title: string; saleLines: { createdAt: Date; authorShare: unknown }[] }) =>
      b.saleLines.map((l) => ({ title: b.title, createdAt: l.createdAt, amount: Number(l.authorShare) }))
    );

    const monthlyMap = new Map<string, { amount: number; units: number }>();
    const bookMap = new Map<string, { unitsSold: number; revenue: number }>();

    for (const l of lines) {
      const monthKey = l.createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      const monthRow = monthlyMap.get(monthKey) ?? { amount: 0, units: 0 };
      monthRow.amount += l.amount;
      monthRow.units += 1;
      monthlyMap.set(monthKey, monthRow);

      const bookRow = bookMap.get(l.title) ?? { unitsSold: 0, revenue: 0 };
      bookRow.unitsSold += 1;
      bookRow.revenue += l.amount;
      bookMap.set(l.title, bookRow);
    }

    return {
      totalSales: lines.length,
      totalRevenue: lines.reduce((s: number, l: { amount: number }) => s + l.amount, 0),
      totalDownloads: lines.length,
      monthlyRevenue: Array.from(monthlyMap.entries()).map(([month, v]) => ({ month, ...v })),
      topBooks: Array.from(bookMap.entries())
        .map(([title, v]) => ({ title, ...v }))
        .sort((a, b) => b.unitsSold - a.unitsSold)
        .slice(0, 10),
    };
  } catch {
    return EMPTY;
  }
}
