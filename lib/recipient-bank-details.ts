import { payoutMethodLabel } from "@/lib/payout-method-label";

/**
 * Reads the bank-transfer fields out of a WiseRecipient (its `type` plus
 * the free-form `details` JSON). The key lists are the SAME ones
 * actions/users-admin-details.ts uses for the admin user page
 * (getUserAdminProfile); that file is a "use server" module and so
 * cannot export a plain synchronous helper, so the shared reader lives
 * here, pure and testable. Anything not on file is "" (never a
 * placeholder), and a non-bank recipient (PayPal, M-Pesa) yields all
 * blanks: the payout exports are bank-transfer only.
 */
export interface PayoutBankDetails {
  bankName: string;
  /** The name as it appears on the bank account (the recipient's own accountHolderName). */
  accountHolder: string;
  accountNumber: string;
  swiftOrRouting: string;
  country: string;
}

export const EMPTY_BANK_DETAILS: PayoutBankDetails = { bankName: "", accountHolder: "", accountNumber: "", swiftOrRouting: "", country: "" };

function pick(details: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = details[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return "";
}

/** True for the recipient types that are bank/wire transfers (see payoutMethodLabel). */
export function isBankRecipientType(type: string): boolean {
  const label = payoutMethodLabel(type);
  return label === "Bank transfer" || label === "Wire transfer";
}

export function extractBankDetails(recipient: { type: string; accountHolderName: string; details: unknown } | null | undefined): PayoutBankDetails {
  if (!recipient || !isBankRecipientType(recipient.type)) return EMPTY_BANK_DETAILS;
  const d = (recipient.details && typeof recipient.details === "object" && !Array.isArray(recipient.details) ? recipient.details : {}) as Record<string, unknown>;
  return {
    bankName: pick(d, ["bankName"]),
    accountHolder: recipient.accountHolderName.trim(),
    accountNumber: pick(d, ["accountNumber", "account_number", "iban"]),
    swiftOrRouting: pick(d, ["swiftOrRoutingCode", "swiftCode", "swift_code", "routingNumber", "routing_number", "sortCode", "sort_code"]),
    country: pick(d, ["country"]),
  };
}
