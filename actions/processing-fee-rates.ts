"use server";

import { revalidatePath } from "next/cache";
import { authEither as auth } from "@/lib/auth-either";
import { isValidRate, type FeeRoute, type GatewayRate } from "@/lib/processing-fee";
import { saveFeeRates } from "@/lib/processing-fee-settings";

/** Admin only: saves the gateway rates the Processing Fee is worked out with. Takes effect for orders started after saving; paid orders are never changed. */
export async function updateProcessingFeeRates(input: Record<FeeRoute, GatewayRate>): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Only Admins can change the Processing Fee rates." };
  for (const route of ["paystack", "mpesa", "paypal"] as FeeRoute[]) {
    if (!isValidRate(input?.[route])) return { ok: false, error: "Each percentage must be between 0% and 50%, and each fixed fee between $0 and $5." };
  }
  await saveFeeRates(input);
  revalidatePath("/admin/processing-fee-rates");
  revalidatePath("/admin/site-health");
  return { ok: true };
}
