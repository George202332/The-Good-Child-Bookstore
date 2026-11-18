/** Withholding tax on payouts: 20% outside Kenya, 5% for Kenya, by the country on the user's profile.
 * The two rates live in the admin setting (Site Settings → Payout Schedule); these are the defaults. */
export const DEFAULT_WITHHOLDING_RATE_KENYA = 5;
export const DEFAULT_WITHHOLDING_RATE_OTHER = 20;

export interface WithholdingRates { kenya: number; other: number }
export const DEFAULT_WITHHOLDING_RATES: WithholdingRates = { kenya: DEFAULT_WITHHOLDING_RATE_KENYA, other: DEFAULT_WITHHOLDING_RATE_OTHER };

function rateOk(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100;
}

export function resolveWithholdingRates(stored: { withholdingRateKenya?: unknown; withholdingRateOther?: unknown } | null | undefined): WithholdingRates {
  return {
    kenya: rateOk(stored?.withholdingRateKenya) ? stored!.withholdingRateKenya as number : DEFAULT_WITHHOLDING_RATE_KENYA,
    other: rateOk(stored?.withholdingRateOther) ? stored!.withholdingRateOther as number : DEFAULT_WITHHOLDING_RATE_OTHER,
  };
}

/** The country on a profile is stored as ISO-2 ("KE") but older rows may hold the name. */
export function isKenya(country: string | null | undefined): boolean {
  const c = (country ?? "").trim().toLowerCase();
  return c === "ke" || c === "kenya";
}

export function withholdingRateFor(country: string | null | undefined, rates: WithholdingRates = DEFAULT_WITHHOLDING_RATES): number {
  return isKenya(country) ? rates.kenya : rates.other;
}

export interface PayoutAmounts { gross: number; rate: number; tax: number; transactionCost: number; net: number }

/** All money is worked in whole cents so the lines always add up exactly. */
export function computePayoutAmounts(gross: number, rate: number, transactionCost = 0): PayoutAmounts {
  const g = Math.round(gross * 100);
  const tax = Math.round((g * rate) / 100);
  const cost = Math.round(transactionCost * 100);
  return { gross: g / 100, rate, tax: tax / 100, transactionCost: cost / 100, net: (g - tax - cost) / 100 };
}
