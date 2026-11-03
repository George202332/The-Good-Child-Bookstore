import { prisma } from "@/lib/prisma";
import { DEFAULT_MIN_PAYOUT_AMOUNT, normaliseMinimumPayout, setMinPayoutAmount } from "@/lib/payout-threshold";

/** Server only. The admin's Minimum Payout lives in the Setting table (no schema change). */
export const MINIMUM_PAYOUT_KEY = "minimum_payout";

export async function getMinimumPayout(): Promise<number> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: MINIMUM_PAYOUT_KEY } });
    const v = row?.value as { amount?: unknown } | null | undefined;
    return v && typeof v === "object" ? normaliseMinimumPayout(v.amount) : DEFAULT_MIN_PAYOUT_AMOUNT;
  } catch {
    return DEFAULT_MIN_PAYOUT_AMOUNT;
  }
}

/** Reads the setting and makes it the live minimum for the rest of this request. Call at the start of any server code that
 * decides what is payable. */
export async function loadMinimumPayout(): Promise<number> {
  return setMinPayoutAmount(await getMinimumPayout());
}
