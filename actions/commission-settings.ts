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
  if (rates.referralPct < 0 || rates.referralPct > 1 || rates.promotionPct < 0 || rates.promotionPct > 1) {
    return { ok: false, error: "Percentages must be between 0% and 100%." };
  }

  await prisma.setting.upsert({
    where: { key: COMMISSION_SETTINGS_KEY },
    update: { value: rates },
    create: { key: COMMISSION_SETTINGS_KEY, value: rates },
  });

  revalidatePath("/admin/commission-settings");
  return { ok: true };
}
