/**
 * Names are saved and shown with the first letter of every name part capitalised, including the
 * part after a hyphen or an apostrophe: "anne-marie o'brien" becomes "Anne-Marie O'Brien".
 * Only first letters are raised; letters the author already capitalised are left alone, so
 * "McDonald" and "DeShawn" are not damaged. Extra spaces are tidied. Pure, so it is unit tested.
 */
export function capitalizeName(raw: string | null | undefined): string {
  const tidy = (raw ?? "").trim().replace(/\s+/g, " ");
  if (!tidy) return "";
  // A letter that starts the text, or follows a space, hyphen or apostrophe (straight or curly).
  return tidy.replace(/(^|[\s\-'’])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase());
}

/** True when saving the name through capitalizeName would change it (used by the read-only report). */
export function nameWouldChange(raw: string | null | undefined): boolean {
  return typeof raw === "string" && raw !== capitalizeName(raw);
}
