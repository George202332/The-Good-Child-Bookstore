import { prisma } from "@/lib/prisma";

/**
 * Real, live platform totals for the homepage stats band — books
 * published / authors / readers / countries served. Every count here is
 * a real, live count from the database (never a placeholder), filtered
 * to real accounts/books only (isTestData: false — same convention used
 * by app/admin/page.tsx) so a non-public demo/test account or book can
 * never push the public homepage past its launch thresholds.
 *
 * The stats band itself only becomes visible again once every one of
 * these thresholds is met simultaneously (see components/StatsBand.tsx
 * and app/page.tsx) — until then, the numbers are still computed (so
 * they're ready the moment the last threshold is crossed) but
 * `thresholdsMet` is false and the section stays hidden.
 */

export const PLATFORM_STATS_THRESHOLDS = {
  books: 5000,
  authors: 1000,
  readers: 2000,
  countries: 10,
} as const;

export interface PlatformStats {
  books: number;
  authors: number;
  readers: number;
  countries: number;
  thresholdsMet: boolean;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const [books, authors, readers, countryRows] = await Promise.all([
    prisma.book.count({ where: { status: "PUBLISHED", isTestData: false } }),
    // Distinct authors with at least an author profile (a signed-up
    // author, whether or not they've published yet, matching how
    // "authors" is counted elsewhere on the site — e.g. app/authors).
    prisma.user.count({ where: { role: "AUTHOR", isTestData: false, authorProfile: { isNot: null } } }),
    prisma.user.count({ where: { role: "READER", isTestData: false } }),
    prisma.user.findMany({
      where: { isTestData: false, country: { not: null } },
      select: { country: true },
      distinct: ["country"],
    }),
  ]);

  const countries = countryRows.length;

  const thresholdsMet =
    books >= PLATFORM_STATS_THRESHOLDS.books &&
    authors >= PLATFORM_STATS_THRESHOLDS.authors &&
    readers >= PLATFORM_STATS_THRESHOLDS.readers &&
    countries >= PLATFORM_STATS_THRESHOLDS.countries;

  return { books, authors, readers, countries, thresholdsMet };
}
