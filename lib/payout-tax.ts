import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computePayoutAmounts, resolveWithholdingRates, withholdingRateFor, type PayoutAmounts } from "@/lib/withholding";

/**
 * Reads and writes the withholding-tax figures of a payout.
 *
 * Raw SQL on purpose: the three columns were added in the amendment-batch
 * migration, and going through raw SQL keeps the app working on the old
 * database until that migration has been run (every call is guarded and
 * falls back quietly instead of breaking a page).
 */

export interface PayoutTaxLine extends PayoutAmounts {
  /** "recorded": stored on the payout when it was created. "estimated": worked out now from the profile country
   * (the payout is not created yet). "none": the payout was made before withholding tax existed, so none was taken. */
  basis: "recorded" | "estimated" | "none";
}

/** Called by createPayoutOnce right after a payout row is created. Never throws. */
export async function recordPayoutTax(payoutId: string, userId: string, gross: number): Promise<void> {
  try {
    const [user, settingsRow] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { country: true } }),
      prisma.setting.findUnique({ where: { key: "site_settings" } }).catch(() => null),
    ]);
    const stored = (settingsRow?.value ?? null) as { withholdingRateKenya?: unknown; withholdingRateOther?: unknown } | null;
    const rate = withholdingRateFor(user?.country, resolveWithholdingRates(stored));
    const a = computePayoutAmounts(gross, rate, 0);
    await prisma.$executeRaw(
      Prisma.sql`UPDATE "PayoutRequest" SET "withholdingRate" = ${a.rate}, "withholdingTax" = ${a.tax}, "transactionCost" = ${a.transactionCost} WHERE id = ${payoutId}`
    );
  } catch {
    // Non-critical here: the payout itself is already saved. The statement shows an estimate if this is missing.
  }
}

interface RawTaxRow { id: string; amount: unknown; requestedAt: Date; withholdingRate: unknown; withholdingTax: unknown; transactionCost: unknown }

/** Every payout of this user with its tax columns, newest first. Empty if the columns do not exist yet. */
export async function listPayoutTaxRows(userId: string): Promise<{ id: string; gross: number; requestedAt: Date; rate: number | null; tax: number | null; cost: number | null }[]> {
  try {
    const rows = await prisma.$queryRaw<RawTaxRow[]>(
      Prisma.sql`SELECT id, amount, "requestedAt", "withholdingRate", "withholdingTax", "transactionCost" FROM "PayoutRequest" WHERE "userId" = ${userId} ORDER BY "requestedAt" DESC`
    );
    return rows.map((r) => ({
      id: r.id,
      gross: Number(r.amount),
      requestedAt: r.requestedAt,
      rate: r.withholdingRate == null ? null : Number(r.withholdingRate),
      tax: r.withholdingTax == null ? null : Number(r.withholdingTax),
      cost: r.transactionCost == null ? null : Number(r.transactionCost),
    }));
  } catch {
    return [];
  }
}

export async function loadTaxContext(userId: string): Promise<{ country: string | null; rates: ReturnType<typeof resolveWithholdingRates> }> {
  const [user, settingsRow] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { country: true } }),
    prisma.setting.findUnique({ where: { key: "site_settings" } }).catch(() => null),
  ]);
  return { country: user?.country ?? null, rates: resolveWithholdingRates((settingsRow?.value ?? null) as { withholdingRateKenya?: unknown; withholdingRateOther?: unknown } | null) };
}

/**
 * The tax lines for one month's payout. `payoutMonthKey` is the month the payout was CREATED in (the month after
 * the earnings month). Several payouts in the same month (an author who is also an affiliate) are added together.
 */
export function taxLineForMonth(
  payoutMonthKey: string,
  gross: number,
  status: string,
  taxRows: Awaited<ReturnType<typeof listPayoutTaxRows>>,
  ctx: Awaited<ReturnType<typeof loadTaxContext>>
): PayoutTaxLine {
  const mine = taxRows.filter((r) => `${r.requestedAt.getFullYear()}-${String(r.requestedAt.getMonth() + 1).padStart(2, "0")}` === payoutMonthKey);
  const recorded = mine.filter((r) => r.rate != null && r.tax != null);
  if (recorded.length > 0) {
    const g = recorded.reduce((a, r) => a + r.gross, 0);
    const tax = recorded.reduce((a, r) => a + (r.tax ?? 0), 0);
    const cost = recorded.reduce((a, r) => a + (r.cost ?? 0), 0);
    const rate = recorded[0].rate ?? 0;
    return { gross: g, rate, tax, transactionCost: cost, net: Math.round((g - tax - cost) * 100) / 100, basis: "recorded" };
  }
  // A payout that is already paid but carries no tax figures was made before withholding tax existed.
  if (status === "Paid" || mine.length > 0) {
    return { ...computePayoutAmounts(gross, 0, 0), basis: "none" };
  }
  const rate = withholdingRateFor(ctx.country, ctx.rates);
  return { ...computePayoutAmounts(gross, rate, 0), basis: "estimated" };
}
