import { COUNTRIES } from "./countries";
import { countryToIso2 } from "./user-country";

export const restrictionMessage = "This book is not available for purchase in your country.";

const ALIASES: Record<string, string> = {
  UK: "GB",
  "U.K.": "GB",
  "GREAT BRITAIN": "GB",
  BRITAIN: "GB",
  ENGLAND: "GB",
  USA: "US",
  "U.S.": "US",
  "U.S.A.": "US",
  "UNITED STATES OF AMERICA": "US",
  UAE: "AE",
};

function toIso2(token: string): string | null {
  const t = token.trim();
  if (!t) return null;
  const alias = ALIASES[t.toUpperCase()];
  if (alias) return alias;
  return countryToIso2(t);
}

/** Accepts an array or legacy free text ("US, CA, UK", full names; split on
 * commas, semicolons, newlines or slashes). Returns unique uppercase ISO-2
 * codes in first-seen order; unrecognised tokens are dropped. */
export function parseRestrictedCountries(input: string | string[] | null | undefined): string[] {
  if (!input) return [];
  const tokens = Array.isArray(input) ? input : input.split(/[,;\n/|]+/);
  const out: string[] = [];
  for (const raw of tokens) {
    if (typeof raw !== "string") continue;
    const iso = toIso2(raw);
    if (iso && COUNTRIES.some((c) => c.iso2 === iso) && !out.includes(iso)) out.push(iso);
  }
  return out;
}

export function isBookRestrictedInCountry(
  restricted: readonly string[] | null | undefined,
  countryIso2: string | null | undefined,
): boolean {
  if (!restricted || restricted.length === 0 || !countryIso2) return false;
  const c = countryIso2.trim().toUpperCase();
  if (!c) return false;
  return restricted.some((r) => r.toUpperCase() === c);
}
