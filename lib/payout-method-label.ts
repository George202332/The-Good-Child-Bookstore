/**
 * Turns a WiseRecipient's raw `type` key (Wise's own account-type name,
 * e.g. "iban", "sort_code", "mpesa" — see lib/payments/wise.ts and the
 * comment on the WiseRecipient model) into the plain payment-method
 * label used on the admin payout ledger (app/admin/payouts/page.tsx):
 * PayPal, bank transfer, or wire transfer, matching how George
 * describes these to himself. Wise's real, dynamic account-requirement
 * types vary by currency and aren't a fixed list, so anything not
 * explicitly recognized below falls back to a readable version of the
 * raw key rather than guessing wrong.
 */
const KNOWN_METHOD_LABELS: Record<string, string> = {
  iban: "Bank transfer",
  sort_code: "Bank transfer",
  account_number: "Bank transfer",
  bsb_code: "Bank transfer",
  sepa: "Bank transfer",
  aba: "Wire transfer",
  swift_code: "Wire transfer",
  swift: "Wire transfer",
  routing_number: "Wire transfer",
  mpesa: "Mobile money (M-Pesa)",
  email: "PayPal / email-linked account",
};

export function payoutMethodLabel(type: string): string {
  const known = KNOWN_METHOD_LABELS[type.toLowerCase()];
  if (known) return known;
  return type
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Flattens a WiseRecipient's `details` JSON (Wise's own dynamic field
 * set for that account type) into one readable line, e.g.
 * "iban: GB29NWBK60161331926819, legalType: PRIVATE". */
export function formatAccountDetails(details: unknown): string {
  if (!details || typeof details !== "object") return "—";
  const entries = Object.entries(details as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (entries.length === 0) return "—";
  return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
}
