/**
 * Masks an account number (platform account ID, bank account, phone payout
 * number) for display to someone other than its owner. Spaces and dashes
 * are dropped first, then:
 *   0 characters      -> ""
 *   1 to 4 characters -> all masked (never reveals a short value)
 *   5 to 8 characters -> masks min(4, length - 3) middle characters,
 *                        keeping up to 2 at the end and the rest at the start
 *   9+ characters     -> masks exactly four middle characters ("****"),
 *                        keeping the rest split between start and end
 * The full value is never returned. Non-digit characters are treated like
 * digits (so IBAN-style values work).
 */
export function maskAccountNumber(value: string | number | null | undefined): string {
  const compact = String(value ?? "").replace(/[\s-]+/g, "");
  const len = compact.length;
  if (len === 0) return "";
  if (len <= 4) return "*".repeat(len);

  if (len <= 8) {
    const masked = Math.min(4, len - 3);
    const revealed = len - masked;
    const trail = Math.min(2, revealed - 1);
    const lead = revealed - trail;
    return compact.slice(0, lead) + "*".repeat(masked) + compact.slice(len - trail);
  }

  const revealed = len - 4;
  const lead = Math.ceil(revealed / 2);
  const trail = revealed - lead;
  return compact.slice(0, lead) + "****" + (trail > 0 ? compact.slice(len - trail) : "");
}
