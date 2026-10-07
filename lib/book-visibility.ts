import { isBookRestrictedInCountry, parseRestrictedCountries } from "./book-country-restriction";

/**
 * Pure helpers that decide whether a book may be SHOWN to, or SOLD to, a
 * particular buyer. Used by the storefront adapter (listings), the product
 * page, the cart resolver and, authoritatively, createPendingOrder.
 *
 * Rule: a book is restricted for a buyer when its restricted-country list
 * contains ANY country we know about for that buyer — the signed-in
 * account's country, the request's IP-geo country, or (print lines only)
 * the ship-to country. An unknown country never restricts anything.
 */

export interface BuyerCountries {
  /** User.country (ISO-2) of the signed-in account, if any. */
  accountCountry?: string | null;
  /** Request IP-geo country (ISO-2) from lib/geo.ts, if known. */
  geoCountry?: string | null;
  /** Ship-to country (ISO-2) — only ever counted for print lines. */
  shipCountry?: string | null;
}

export type SaleFormat = "ebook" | "paperback" | "hardcover" | "audiobook";

export function isPrintFormat(format: string | null | undefined): boolean {
  return format === "paperback" || format === "hardcover";
}

/** The visitor-level country list (account + geo), de-duplicated and
 * upper-cased, with unknowns dropped. */
export function visitorCountryList(c: BuyerCountries): string[] {
  const out: string[] = [];
  for (const raw of [c.accountCountry, c.geoCountry]) {
    const v = raw?.trim().toUpperCase();
    if (v && !out.includes(v)) out.push(v);
  }
  return out;
}

/** True when `restricted` blocks any of the given countries. */
export function isRestrictedForCountries(
  restricted: readonly string[] | null | undefined,
  countries: readonly (string | null | undefined)[],
): boolean {
  return countries.some((c) => isBookRestrictedInCountry(restricted, c));
}

/** Is this specific purchase line blocked for this buyer? The ship-to
 * country only applies to print formats (digital goods are not shipped). */
export function isLineRestricted(
  restricted: readonly string[] | null | undefined,
  buyer: BuyerCountries,
  format?: string | null,
): boolean {
  const countries = visitorCountryList(buyer);
  if (isPrintFormat(format) && buyer.shipCountry) countries.push(buyer.shipCountry);
  return isRestrictedForCountries(restricted, countries);
}

/** The effective restricted-country list of a stored book: the real
 * Book.restrictedCountries array, or — for older books that only carry the
 * legacy free-text field — submissionMetadata.countryRestrictions when
 * submissionMetadata.worldwideRights was explicitly false. */
export function effectiveRestrictedCountries(book: {
  restrictedCountries?: readonly string[] | null;
  submissionMetadata?: unknown;
}): string[] {
  const direct = parseRestrictedCountries(book.restrictedCountries ? [...book.restrictedCountries] : []);
  if (direct.length > 0) return direct;
  const meta = (book.submissionMetadata ?? null) as { worldwideRights?: unknown; countryRestrictions?: unknown } | null;
  if (meta && meta.worldwideRights === false && typeof meta.countryRestrictions === "string") {
    return parseRestrictedCountries(meta.countryRestrictions);
  }
  return [];
}

/** Old data only: a book is withheld from the store ONLY when
 * submissionMetadata.sellOnStore is explicitly false. */
export function isSellOnStoreDisabled(submissionMetadata: unknown): boolean {
  const meta = (submissionMetadata ?? null) as { sellOnStore?: unknown } | null;
  return !!meta && meta.sellOnStore === false;
}

/** Listing visibility: sold on the store AND not restricted for the visitor. */
export function isBookVisibleToVisitor(
  book: { restrictedCountries?: readonly string[] | null; sellOnStore?: boolean },
  visitorCountries: readonly (string | null | undefined)[] = [],
): boolean {
  if (book.sellOnStore === false) return false;
  return !isRestrictedForCountries(book.restrictedCountries, visitorCountries);
}

export interface FormatPricingInput {
  price: unknown;
  ebookPrice: unknown;
  paperbackPrice: unknown;
  hardcoverPrice: unknown;
  audiobookPrice: unknown;
  hasEbook: boolean;
  hasPrint: boolean;
  hasAudiobook: boolean;
  files: readonly { kind: string }[];
  submissionMetadata?: unknown;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** The price to charge for a format, or null when that format has no price
 * (and so cannot be sold). Only the eBook falls back to the book's base
 * price; paperback, hardcover and audiobook NEVER silently borrow another
 * format's price. */
export function resolveFormatPrice(book: FormatPricingInput, format: SaleFormat): number | null {
  const meta = (book.submissionMetadata ?? null) as {
    paperbackEnabled?: boolean; hardcoverEnabled?: boolean;
    paperbackRetailPrice?: number; hardcoverRetailPrice?: number;
  } | null;
  switch (format) {
    case "ebook": return numOrNull(book.ebookPrice) ?? numOrNull(book.price);
    case "paperback": return numOrNull(book.paperbackPrice) ?? (meta?.paperbackEnabled ? numOrNull(meta.paperbackRetailPrice) : null);
    case "hardcover": return numOrNull(book.hardcoverPrice) ?? (meta?.hardcoverEnabled ? numOrNull(meta.hardcoverRetailPrice) : null);
    case "audiobook": return numOrNull(book.audiobookPrice);
  }
}

/** Is the format genuinely on sale for this book? The audiobook needs the
 * flag, an uploaded AUDIOBOOK file AND a price. */
export function isFormatPurchasable(book: FormatPricingInput, format: SaleFormat): boolean {
  const price = resolveFormatPrice(book, format);
  switch (format) {
    case "ebook": return book.hasEbook && price !== null;
    case "paperback":
    case "hardcover": return book.hasPrint && price !== null;
    case "audiobook": return book.hasAudiobook && book.files.some((f) => f.kind === "AUDIOBOOK") && price !== null;
  }
}
