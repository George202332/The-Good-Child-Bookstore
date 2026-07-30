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
  /** Book sales (organic or affiliate) so far in the current calendar
   * month — replaces the old "Active Titles" stat card slot. */
  monthSalesCount: number;
  monthlySales: { month: string; units: number }[];
  formatBreakdown: { format: string; count: number }[];
  saleTypeBreakdown: { type: string; count: number }[];
  topCountries: { country: string; count: number }[];
  /** Same top countries, with each one's share of total sales as a
   * percentage — for the new regions pie chart. */
  topCountriesWithPct: { country: string; count: number; pct: number }[];
  topBooks: { title: string; unitsSold: number }[];
  /** Real 2-letter ISO country codes with at least one geotagged
   * purchase (see lib/geo.ts) — used for the world map specifically,
   * since it needs real codes, not the free-text country names a
   * reader's saved address may contain. */
  geoCountryCodes: string[];
}

const EMPTY: AuthorAnalyticsSummary = {
  totalSales: 0, totalDownloads: 0, countriesReached: 0, activeTitles: 0, monthSalesCount: 0,
  monthlySales: [], formatBreakdown: [], saleTypeBreakdown: [], topCountries: [], topCountriesWithPct: [],
  topBooks: [], geoCountryCodes: [],
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

    const currentYear = new Date().getFullYear();
    const monthlyMap = new Map<string, number>();
    for (let m = 0; m < 12; m++) {
      monthlyMap.set(new Date(currentYear, m, 1).toLocaleDateString("en-US", { month: "short" }), 0);
    }
    const formatMap = new Map<string, number>();
    const saleTypeMap = new Map<string, number>();
    const countryMap = new Map<string, number>();
    const geoCountryCodeSet = new Set<string>();
    const bookMap = new Map<string, number>();
    const now = new Date();
    let monthSalesCount = 0;

    for (const l of lines) {
      if (l.createdAt.getFullYear() === currentYear) {
        const monthKey = l.createdAt.toLocaleDateString("en-US", { month: "short" });
        monthlyMap.set(monthKey, (monthlyMap.get(monthKey) ?? 0) + 1);
      }
      if (l.createdAt.getFullYear() === now.getFullYear() && l.createdAt.getMonth() === now.getMonth()) {
        monthSalesCount += 1;
      }

      const formatLabel = FORMAT_LABELS[l.format ?? ""] ?? "Unspecified";
      formatMap.set(formatLabel, (formatMap.get(formatLabel) ?? 0) + 1);

      const typeLabel = l.saleType === "AFFILIATE" ? "Via affiliate link" : "Organic";
      saleTypeMap.set(typeLabel, (saleTypeMap.get(typeLabel) ?? 0) + 1);

      const addresses = l.order.reader.addresses;
      const country = l.order.country ?? addresses.find((a) => a.isDefault)?.country ?? addresses[0]?.country;
      if (country) countryMap.set(country, (countryMap.get(country) ?? 0) + 1);
      if (l.order.country) geoCountryCodeSet.add(l.order.country.toUpperCase());

      bookMap.set(l.title, (bookMap.get(l.title) ?? 0) + 1);
    }

    const topCountriesEntries = Array.from(countryMap.entries()).sort((a, b) => b[1] - a[1]);
    const totalCountrySales = topCountriesEntries.reduce((s, [, c]) => s + c, 0);

    return {
      totalSales: lines.length,
      totalDownloads: lines.length,
      countriesReached: countryMap.size,
      activeTitles: books.filter((b) => b.status === "PUBLISHED").length,
      monthSalesCount,
      monthlySales: Array.from(monthlyMap.entries()).map(([month, units]) => ({ month, units })),
      formatBreakdown: Array.from(formatMap.entries()).map(([format, count]) => ({ format, count })),
      saleTypeBreakdown: Array.from(saleTypeMap.entries()).map(([type, count]) => ({ type, count })),
      topCountries: topCountriesEntries.map(([country, count]) => ({ country, count })).slice(0, 8),
      topCountriesWithPct: topCountriesEntries.slice(0, 5).map(([country, count]) => ({
        country, count, pct: totalCountrySales > 0 ? +((count / totalCountrySales) * 100).toFixed(1) : 0,
      })),
      geoCountryCodes: Array.from(geoCountryCodeSet),
      topBooks: Array.from(bookMap.entries()).map(([title, unitsSold]) => ({ title, unitsSold })).sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 10),
    };
  } catch {
    return EMPTY;
  }
}
