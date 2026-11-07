import { prisma } from "@/lib/prisma";
import { DEFAULT_FEE_RATES, normalizeRates, type FeeRates, type FeeRoute, type GatewayRate } from "@/lib/processing-fee";

/** Server only: the gateway rates the Processing Fee is worked out with (admin-editable, saved in the Setting table). */
const KEY = "processing_fee_rates";

export async function getFeeRates(): Promise<FeeRates> {
  try {
    const row = await prisma.setting.findUnique({ where: { key: KEY } });
    return normalizeRates(row?.value);
  } catch {
    return DEFAULT_FEE_RATES;
  }
}

export async function isUsingDefaultRates(): Promise<boolean> {
  try {
    return !(await prisma.setting.findUnique({ where: { key: KEY } }));
  } catch {
    return true;
  }
}

export async function saveFeeRates(next: Record<FeeRoute, GatewayRate>): Promise<void> {
  const value = JSON.parse(JSON.stringify(normalizeRates(next)));
  await prisma.setting.upsert({ where: { key: KEY }, create: { key: KEY, value }, update: { value } });
}
