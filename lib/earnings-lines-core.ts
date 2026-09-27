/**
 * The pure, Prisma-free half of lib/earnings-lines.ts — the shapes and
 * categorization logic that don't need a database connection. Split
 * out into its own file so this logic can be unit-tested (see
 * tests/earnings-lines.test.ts) without transitively importing
 * lib/prisma.ts, which constructs a real PrismaClient at module load.
 * lib/earnings-lines.ts re-exports everything here alongside the
 * actual database-backed fetch, so every existing caller is unaffected.
 */

export interface EarningsLine {
  createdAt: Date;
  amount: number;
}

export interface EarningsBreakdown {
  /** The author's own royalty share of their book sales — whether the
   * reader found the book directly or via someone else's affiliate
   * link (the SHARE either way is the author's; who gets the
   * affiliate cut is tracked separately, see `commission` below). */
  organic: EarningsLine[];
  /** A cut of company revenue from authors this person personally
   * referred onto the platform. */
  referral: EarningsLine[];
  /** Commission from copies sold through this person's own affiliate
   * promotional links. */
  commission: EarningsLine[];
}

/** Optional calendar-month (or any) date window to scope the query to —
 * omit for this user's full lifetime history. */
export interface DateRange {
  start: Date;
  end: Date;
}

/** Flattens a breakdown down to the single list of lines relevant to
 * one "wallet" view — author royalties, or affiliate earnings
 * (commission + referral combined) — for callers that don't need the
 * categories kept separate (see actions/wallet.ts). */
export function linesForView(breakdown: EarningsBreakdown, view: "author" | "affiliate"): EarningsLine[] {
  return view === "author" ? breakdown.organic : [...breakdown.commission, ...breakdown.referral];
}

export function sumLines(lines: EarningsLine[]): number {
  return lines.reduce((sum, l) => sum + l.amount, 0);
}
