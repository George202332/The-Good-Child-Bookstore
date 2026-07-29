import { prisma } from "@/lib/prisma";

/**
 * Commission percentages, controllable from the backend (Admin →
 * Commission Settings) instead of being hardcoded — stored under the
 * same generic Setting key-value table already used for site branding
 * (actions/site-settings.ts), so no schema change is needed.
 *
 * referralPct: what an affiliate earns, for life, from the COMPANY's
 * revenue on books sold by an author they referred onto the platform.
 * Moved from 3% to 5% per explicit instruction — this is now the
 * default AND the starting value shown in the admin settings screen.
 *
 * promotionPct: what an affiliate earns per sale made through their own
 * direct promotional link for a book (their "10% of the sale" cut).
 */

export interface CommissionRates {
  referralPct: number;
  promotionPct: number;
}

export const DEFAULT_COMMISSION_RATES: CommissionRates = {
  referralPct: 0.05,
  promotionPct: 0.10,
};

const COMMISSION_SETTINGS_KEY = "commission_rates";

export async function getCommissionRates(): Promise<CommissionRates> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: COMMISSION_SETTINGS_KEY } });
    if (setting?.value && typeof setting.value === "object") {
      const stored = setting.value as Partial<CommissionRates>;
      return { ...DEFAULT_COMMISSION_RATES, ...stored };
    }
  } catch {
    // Fall through to defaults if the database is unreachable.
  }
  return DEFAULT_COMMISSION_RATES;
}
