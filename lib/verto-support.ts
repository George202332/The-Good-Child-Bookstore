import { isPayoutRestrictedCountry } from "@/lib/payout-country-restriction";

/**
 * Which countries a Bank Transfer payout can be sent to, through Verto.
 *
 * Rule agreed with the owner: Verto decides. The moment a Verto lookup is wired in (it needs the Verto business
 * account and its keys, which do not exist yet), its answer wins over our built-in list. Until then the built-in rule
 * is used: every country except the ones we already cannot pay (lib/payout-country-restriction.ts).
 *
 * If Verto IS set up but cannot be reached, the screen shows a calm "Please try again later" and never a form.
 */
export type CountrySupport =
  | { state: "supported"; source: "verto" | "builtin" }
  | { state: "unsupported"; source: "verto" | "builtin"; message: string }
  | { state: "unreachable"; message: string };

export const VERTO_TRY_LATER_MESSAGE = "Bank Transfer details cannot be loaded right now. Please try again later.";
export const COUNTRY_UNSUPPORTED_MESSAGE = "We are not able to send payouts to this country at the moment. Please choose a different country, or contact us if your bank is in another country.";

/** Names of the Vercel variables the live Verto lookup will read (values live ONLY in Vercel). */
export const VERTO_ENV_NAMES = ["VERTO_CLIENT_ID", "VERTO_CLIENT_SECRET", "VERTO_WEBHOOK_SECRET"] as const;

export function isVertoConfigured(): boolean {
  return !!process.env.VERTO_CLIENT_ID && !!process.env.VERTO_CLIENT_SECRET;
}

/**
 * The place the live Verto answer plugs in. Returns null while no real Verto lookup exists (Verto publishes none yet),
 * a CountrySupport when Verto answered, or {state:"unreachable"} when Verto is set up but did not answer.
 */
async function askVerto(_iso2: string): Promise<CountrySupport | null> {
  void _iso2;
  return null;
}

export async function getCountrySupport(iso2: string | null | undefined): Promise<CountrySupport> {
  if (!iso2 || !iso2.trim()) return { state: "unsupported", source: "builtin", message: "Choose the country of your bank first." };
  if (isVertoConfigured()) {
    const answer = await askVerto(iso2);
    if (answer) return answer;
  }
  if (isPayoutRestrictedCountry(iso2)) return { state: "unsupported", source: "builtin", message: COUNTRY_UNSUPPORTED_MESSAGE };
  return { state: "supported", source: "builtin" };
}
