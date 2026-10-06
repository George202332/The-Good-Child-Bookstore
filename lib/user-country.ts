import { COUNTRIES } from "@/lib/countries";

/**
 * Country resolution for the admin Users table and user detail page.
 *
 * Country is stored in several places and in two formats:
 *   - User.country           ISO 3166-1 alpha-2 code ("KE"), set at signup
 *                            (actions/auth.ts registerUser). Null for
 *                            accounts created before that field existed,
 *                            by an admin (createUserAccount) or via guest
 *                            checkout (actions/orders.ts).
 *   - AuthorProfile.country  free text the author typed on their profile
 *                            ("Kenya") or the code copied at signup.
 *   - Address.country        free text on a reader's saved address.
 *   - Order.shipCountry / Order.country  shipping country typed at
 *                            checkout / IP-geo tag at purchase time.
 *
 * Nothing here guesses: if none of those hold a value the result is
 * null and the UI shows "Not collected".
 */

export const COUNTRY_NOT_COLLECTED = "Not collected";

/** Turns a code ("KE") or a name ("kenya") into the full country name.
 * Unrecognised text is returned as typed (trimmed) rather than dropped. */
export function countryDisplayName(value: string | null | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  const byCode = COUNTRIES.find((c) => c.iso2 === v.toUpperCase());
  if (byCode) return byCode.name;
  const byName = COUNTRIES.find((c) => c.name.toLowerCase() === v.toLowerCase());
  return byName ? byName.name : v;
}

export interface CountrySources {
  userCountry: string | null;
  authorCountry: string | null;
  addressCountry: string | null;
  orderCountry: string | null;
}

export interface ResolvedCountry {
  name: string;
  source: string;
}

/** First non-empty source wins, in order of how reliably it reflects the
 * account holder's own choice. */
export function resolveUserCountry(s: CountrySources): ResolvedCountry | null {
  const chain: [string | null, string][] = [
    [s.userCountry, "Account (chosen at sign-up)"],
    [s.authorCountry, "Author profile"],
    [s.addressCountry, "Default address"],
    [s.orderCountry, "Most recent order"],
  ];
  for (const [raw, source] of chain) {
    const name = countryDisplayName(raw);
    if (name) return { name, source };
  }
  return null;
}
