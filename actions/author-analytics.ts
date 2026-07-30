"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Real per-author ANALYTICS — deliberately pure numbers (sale counts,
 * download counts, format/channel/region breakdowns), never currency.
 * Revenue and earnings already have their own real home on the Revenue
 * page — this page answers "how are my books performing" as a
 * performance/behavior question, not a money question.
 */

export interface AuthorAnalyticsSummary {
  totalSales: number;
  totalDownloads: number;
  countriesReached: number;
  activeTitles: number;
  monthlySales: { month: string; units: number }[];
  formatBreakdown: { format: string; count: number }[];
  saleTypeBreakdown: { type: string; count: number }[];
  topCountries: { country: string; count: number }[];
  topBooks: { title: string; unitsSold: number }[];
}

const EMPTY: AuthorAnalyticsSummary = {
  totalSales: 0, totalDownloads: 0, countriesReached: 0, activeTitles: 0,
  monthlySales: [], formatBreakdown: [], saleTypeBreakdown: [], topCountries: [], topBooks: [],
};

const FORMAT_LABELS: Record<string, string> = { EBOOK: "eBook", PAPERBACK: "Paperback", HARDCOVER: "Hardcover", AUDIOBOOK: "Audiobook" };

export async function getAuthorAnalytics(): Promise<AuthorAnalyticsSummary> {
  const session = await auth();
  if (session?.user?.role !== "AUTHOR") return EMPTY;

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        authorProfile: {
          include: {
            books: {
              include: {
                saleLines: {
                  include: { order: { include: { reader: { include: { addresses: true } } } } },
                },
              },
            },
          },
        },
      },
    });
    const books = (user?.authorProfile?.books ?? []) as {
      title: string;
      status: string;
      saleLines: {
        createdAt: Date;
        format: string | null;
        saleType: string;
        order: { country: string | null; reader: { addresses: { country: string; isDefault: boolean }[] } };
      }[];
    }[];

    const lines = books.flatMap((b) => b.saleLines.map((l) => ({ ...l, title: b.title })));

    const monthlyMap = new Map<string, number>();
    const formatMap = new Map<string, number>();
    const saleTypeMap = new Map<string, number>();
    const countryMap = new Map<string, number>();
    const bookMap = new Map<string, number>();

    for (const l of lines) {
      const monthKey = l.createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      monthlyMap.set(monthKey, (monthlyMap.get(monthKey) ?? 0) + 1);

      const formatLabel = FORMAT_LABELS[l.format ?? ""] ?? "Unspecified";
      formatMap.set(formatLabel, (formatMap.get(formatLabel) ?? 0) + 1);

      const typeLabel = l.saleType === "AFFILIATE" ? "Via affiliate link" : "Organic";
      saleTypeMap.set(typeLabel, (saleTypeMap.get(typeLabel) ?? 0) + 1);

      const addresses = l.order.reader.addresses;
      const country = l.order.country ?? addresses.find((a) => a.isDefault)?.country ?? addresses[0]?.country;
      if (country) countryMap.set(country, (countryMap.get(country) ?? 0) + 1);

      bookMap.set(l.title, (bookMap.get(l.title) ?? 0) + 1);
    }

    return {
      totalSales: lines.length,
      totalDownloads: lines.length,
      countriesReached: countryMap.size,
      activeTitles: books.filter((b) => b.status === "PUBLISHED").length,
      monthlySales: Array.from(monthlyMap.entries()).map(([month, units]) => ({ month, units })),
      formatBreakdown: Array.from(formatMap.entries()).map(([format, count]) => ({ format, count })),
      saleTypeBreakdown: Array.from(saleTypeMap.entries()).map(([type, count]) => ({ type, count })),
      topCountries: Array.from(countryMap.entries()).map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count).slice(0, 8),
      topBooks: Array.from(bookMap.entries()).map(([title, unitsSold]) => ({ title, unitsSold })).sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 10),
    };
  } catch {
    return EMPTY;
  }
}
