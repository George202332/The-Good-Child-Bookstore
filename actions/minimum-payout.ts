"use server";

import { revalidatePath } from "next/cache";
import { authEither as auth } from "@/lib/auth-either";
import { prisma } from "@/lib/prisma";
import { MINIMUM_PAYOUT_KEY } from "@/lib/payout-minimum";
import { normaliseMinimumPayout } from "@/lib/payout-threshold";

/** Admin only: change the Minimum Payout. Balances under it are never lost - they carry over and add up. */
export async function updateMinimumPayout(amount: number): Promise<{ ok: boolean; error?: string; amount?: number }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Only Admins can change the Minimum Payout." };
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0.01 || n > 100000) return { ok: false, error: "Enter an amount between $0.01 and $100,000." };
  const value = { amount: normaliseMinimumPayout(n) };
  await prisma.setting.upsert({ where: { key: MINIMUM_PAYOUT_KEY }, update: { value }, create: { key: MINIMUM_PAYOUT_KEY, value } });
  revalidatePath("/admin/payouts");
  revalidatePath("/account/payout-settings");
  return { ok: true, amount: value.amount };
}
