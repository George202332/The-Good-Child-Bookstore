/**
 * Format identifiers. The identifier belongs to the format, not the book:
 *
 *   eBook + Audiobook share ONE identifier, the "SN number" - an internal reference the
 *   site generates (13 digits starting with 5). An author who has their own ISBN for the
 *   eBook can enter it, and it replaces the generated SN (the audiobook inherits it).
 *   Print (Paperback / Hardcover) shows an ISBN, one per format, never shared.
 */

/** Strips spaces/hyphens; returns the digits (and a trailing X) of a plausible ISBN-10/13, else "". */
export function cleanIsbn(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const v = raw.replace(/[\s-]/g, "").toUpperCase();
  return /^(\d{13}|\d{9}[\dX])$/.test(v) ? v : "";
}

/** Valid ISBN-13 check digit. */
export function isValidIsbn13(isbn: string): boolean {
  if (!/^\d{13}$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === Number(isbn[12]);
}

/** A real ISBN starts 978/979; the site's own serial numbers start with 5. */
export function isRealIsbn(value: string | null | undefined): boolean {
  const v = (value ?? "").replace(/[\s-]/g, "");
  return /^(978|979)\d{10}$/.test(v) || /^\d{9}[\dX]$/i.test(v);
}

/** Hyphenless digits grouped for display: 978-1-23456-789-0 style is not guessable
 * (group sizes vary), so a real ISBN is shown as typed; this only trims whitespace. */
export function displayIdentifier(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export type IdentifierFormat = "ebook" | "audiobook" | "paperback" | "hardcover";

export interface IdentifierSource {
  /** Book.isbn: the SN number (or the author's own ISBN) for eBook/Audiobook rows. */
  isbn: string | null | undefined;
  hasEbook: boolean;
  hasAudiobook: boolean;
  hasPrint: boolean;
  /** submissionMetadata.printIsbn: the ONE ISBN of the print edition (Paperback and Hardcover). */
  printIsbn?: string | null;
  /** Older saves (Round 46) kept a separate entry per print format; read only, never written. */
  printIsbns?: { paperback?: string; hardcover?: string } | null;
}

export interface FormatIdentifier {
  /** "SN number" or "ISBN" */
  label: "SN number" | "ISBN";
  /** null = not available yet (print: pending) */
  value: string | null;
}

/** The print edition's single ISBN, or null. Reads `printIsbn`; older records that kept a
 * per-format entry fall back to the Paperback one, then the Hardcover one. */
export function printIsbnOf(src: IdentifierSource): string | null {
  const one = (src.printIsbn ?? "").trim();
  if (one) return one;
  const old = src.printIsbns;
  const legacy = (old?.paperback ?? "").trim() || (old?.hardcover ?? "").trim();
  if (legacy) return legacy;
  const printOnly = src.hasPrint && !src.hasEbook && !src.hasAudiobook;
  const record = (src.isbn ?? "").trim();
  // Oldest print-only records stored their ISBN in the record's own isbn field.
  if (printOnly && record && !src.printIsbns && src.printIsbn === undefined) return record;
  return null;
}

/** Reads the print ISBN fields out of a book's submissionMetadata. */
export function printFieldsOf(meta: unknown): Pick<IdentifierSource, "printIsbn" | "printIsbns"> {
  const m = (meta ?? {}) as { printIsbn?: unknown; printIsbns?: { paperback?: string; hardcover?: string } };
  return { printIsbn: typeof m.printIsbn === "string" ? m.printIsbn : null, printIsbns: m.printIsbns ?? null };
}

/**
 * The identifier to show for one format.
 *  - eBook / Audiobook: Book.isbn. Labelled "ISBN" when it is a real ISBN the author
 *    entered, otherwise "SN number".
 *  - Paperback / Hardcover: ONE ISBN for the whole print edition (the same value on both
 *    tabs), or null, which the product page shows as "ISBN pending".
 */
export function identifierFor(src: IdentifierSource, format: IdentifierFormat): FormatIdentifier {
  if (format === "ebook" || format === "audiobook") {
    const v = (src.isbn ?? "").trim();
    if (!v || (!src.hasEbook && !src.hasAudiobook)) return { label: "SN number", value: null };
    return { label: isRealIsbn(v) ? "ISBN" : "SN number", value: v };
  }
  return { label: "ISBN", value: src.hasPrint ? printIsbnOf(src) : null };
}

/** The "SN number" column of the admin table: eBook/Audiobook identifier, or null. */
export function snColumn(src: IdentifierSource): string | null {
  return identifierFor(src, src.hasEbook ? "ebook" : "audiobook").value;
}

/** The "ISBN" column of the admin table: the print edition's single ISBN, or null. */
export function isbnColumn(src: IdentifierSource): string | null {
  return src.hasPrint ? printIsbnOf(src) : null;
}
