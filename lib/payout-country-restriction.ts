/**
 * Countries where standard payout processing isn't currently available
 * — per explicit instruction, this is a PAYOUT restriction only, never
 * a signup block: anyone can sign up and shop as a Reader regardless of
 * country (see actions/auth.ts). It only applies the moment someone
 * tries to add or activate a new payout-earning method (an Author
 * publishing/receiving royalties, or a Reader's affiliate earnings) —
 * see actions/payout-methods.ts addPayoutMethod/setActivePayoutMethod
 * and app/account/profile/PaymentDetailsSection.tsx.
 *
 * Stored as the ISO 3166-1 alpha-2 codes used everywhere else `country`
 * is stored in this app (see lib/geo.ts / User.country) — matches
 * lib/countries.ts's own `iso2` values.
 *
 * Crimea, Donetsk, and Luhansk are occupied Ukrainian regions, not
 * countries — they aren't separately selectable in a standard
 * country field (this app's included anywhere a user picks or is
 * assigned a country, including signup — see lib/countries.ts), so
 * there's nothing to list a code for here. If a user's country field
 * ever does contain one of these as a free-text value (e.g. entered
 * manually elsewhere in the app), that would need manual/admin
 * handling — this check can't catch it automatically.
 */
const PAYOUT_RESTRICTED_COUNTRY_CODES = new Set([
  "AF", // Afghanistan
  "BY", // Belarus
  "BI", // Burundi
  "CF", // Central African Republic
  "TD", // Chad
  "CG", // Congo (Republic of the Congo)
  "CD", // Democratic Republic of the Congo
  "CU", // Cuba
  "ER", // Eritrea
  "IR", // Iran
  "IQ", // Iraq
  "LY", // Libya
  "MM", // Myanmar
  "KP", // North Korea
  "SY", // Syria
  "RU", // Russia
]);

export function isPayoutRestrictedCountry(country: string | null | undefined): boolean {
  if (!country) return false;
  return PAYOUT_RESTRICTED_COUNTRY_CODES.has(country.trim().toUpperCase());
}

/** Shown to a user whose country is on the list when they try to add or
 * activate a new payout method — deliberately never names Wise or
 * Payoneer (neither is used any more) and never proactively suggests
 * PayPal or any other specific alternative. */
export function payoutRestrictionMessage(): string {
  return "Standard payout processing isn't currently available for your country. If you already have a working payout method on file, it remains usable as-is.";
}
