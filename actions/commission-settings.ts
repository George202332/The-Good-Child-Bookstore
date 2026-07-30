"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getCommissionRates, type CommissionRates } from "@/lib/commission-settings";

const COMMISSION_SETTINGS_KEY = "commission_rates";

export { getCommissionRates };

export async function updateCommissionRates(rates: CommissionRates): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { ok: false, error: "Only Admins can change commission rates." };
  }
  if (rates.promotionPct < 0 || rates.promotionPct > 1) {
    return { ok: false, error: "Percentages must be between 0% and 100%." };
  }
  if (!Array.isArray(rates.tiers) || rates.tiers.length === 0) {
    return { ok: false, error: "At least one tier is required." };
  }
  for (const t of rates.tiers) {
    if (t.pct < 0 || t.pct > 1) return { ok: false, error: `${t.name}'s percentage must be between 0% and 100%.` };
    if (t.minReferrals < 0) return { ok: false, error: `${t.name}'s minimum can't be negative.` };
    if (t.maxReferrals !== null && t.maxReferrals < t.minReferrals) {
      return { ok: false, error: `${t.name}'s maximum can't be less than its minimum.` };
    }
  }

  const value = JSON.parse(JSON.stringify(rates));
  await prisma.setting.upsert({
    where: { key: COMMISSION_SETTINGS_KEY },
    update: { value },
    create: { key: COMMISSION_SETTINGS_KEY, value },
  });

  revalidatePath("/admin/commission-settings");
  revalidatePath("/account/referrals/tier");
  return { ok: true };
}
