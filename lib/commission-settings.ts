import { prisma } from "@/lib/prisma";

/**
 * Commission percentages, controllable from the backend (Admin →
 * Commission Settings) instead of being hardcoded — stored under the
 * same generic Setting key-value table already used for site branding
 * (actions/site-settings.ts), so no schema change is needed.
 *
 * Referral commission is now tiered (see CommissionTier below) —
 * replacing the old flat 5% rate — to reward affiliates who bring in
 * more authors with a genuinely better rate the more they grow the
 * platform, rather than a single number regardless of scale.
 *
 * promotionPct: what an affiliate earns per sale made through their own
 * direct promotional link for a book (their "10% of the sale" cut) —
 * unchanged, still flat regardless of tier.
 */

export interface CommissionTier {
  name: string;
  minReferrals: number;
  /** null means no upper bound (the top tier). */
  maxReferrals: number | null;
  pct: number;
}

export interface CommissionRates {
  promotionPct: number;
  tiers: CommissionTier[];
}

export const DEFAULT_TIERS: CommissionTier[] = [
  { name: "Hawk", minReferrals: 0, maxReferrals: 200, pct: 0.05 },
  { name: "Falcon", minReferrals: 201, maxReferrals: 500, pct: 0.075 },
  { name: "Eagle", minReferrals: 501, maxReferrals: 1000, pct: 0.10 },
  { name: "Phoenix", minReferrals: 1001, maxReferrals: null, pct: 0.15 },
];

export const DEFAULT_COMMISSION_RATES: CommissionRates = {
  promotionPct: 0.10,
  tiers: DEFAULT_TIERS,
};

const COMMISSION_SETTINGS_KEY = "commission_rates";

export async function getCommissionRates(): Promise<CommissionRates> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: COMMISSION_SETTINGS_KEY } });
    if (setting?.value && typeof setting.value === "object") {
      const stored = setting.value as Partial<CommissionRates>;
      const tiers = Array.isArray(stored.tiers) && stored.tiers.length > 0 ? stored.tiers : DEFAULT_TIERS;
      return { ...DEFAULT_COMMISSION_RATES, ...stored, tiers };
    }
  } catch {
    // Fall through to defaults if the database is unreachable.
  }
  return DEFAULT_COMMISSION_RATES;
}

/** Which tier a given number of referred authors falls into — always
 * returns a tier (falls back to the lowest one, Hawk, for 0 referrals). */
export function tierForReferralCount(count: number, tiers: CommissionTier[] = DEFAULT_TIERS): CommissionTier {
  return tiers.find((t) => count >= t.minReferrals && (t.maxReferrals === null || count <= t.maxReferrals)) ?? tiers[0];
}

/** The current tier's rate for a specific affiliate, based on their
 * live referred-author count — this is what actually gets applied to a
 * new sale's referral carve-out, so an affiliate's rate keeps up with
 * their real progress rather than being locked in at signup. */
export async function getReferralPctForCount(referredAuthorsCount: number): Promise<number> {
  const rates = await getCommissionRates();
  return tierForReferralCount(referredAuthorsCount, rates.tiers).pct;
}
