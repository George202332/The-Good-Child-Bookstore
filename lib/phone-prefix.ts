import { COUNTRIES } from "@/lib/countries";

/**
 * The phone number prefix that goes with a country, and the rules for when it follows the country.
 * Pure, so the rules are tested.
 *
 *   - Choosing (or changing) the country sets the prefix to that country's dialing code, keeping the number typed.
 *   - Once the customer picks a prefix by hand (for example a phone registered in another country) that choice
 *     sticks: changing the country afterwards does not overwrite it.
 */

/** The dialing code for a country name (for example "Kenya" gives "+254"), or null when the country is unknown. */
export function dialCodeForCountry(countryName: string | null | undefined): string | null {
  if (!countryName) return null;
  return COUNTRIES.find((c) => c.name === countryName)?.dialCode ?? null;
}

/** Every distinct dialing code, once each (many countries share +1), numerically ordered, for the prefix list. */
export function dialCodeOptions(): string[] {
  const codes = Array.from(new Set(COUNTRIES.map((c) => c.dialCode)));
  return codes.sort((a, b) => Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, "")));
}

export interface PhonePrefixState {
  /** For example "+254". */
  prefix: string;
  /** True once the customer has chosen the prefix by hand. */
  manual: boolean;
}

/** What the prefix becomes when the country changes. */
export function prefixAfterCountryChange(state: PhonePrefixState, newCountryName: string): PhonePrefixState {
  if (state.manual) return state;
  const code = dialCodeForCountry(newCountryName);
  return code ? { prefix: code, manual: false } : state;
}

/** What the prefix becomes when the customer picks one by hand: it sticks. */
export function prefixAfterManualChoice(prefix: string): PhonePrefixState {
  return { prefix, manual: true };
}
