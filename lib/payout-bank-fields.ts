/**
 * Bank Transfer fields per country (paid through Verto).
 *
 * Verto does not publish a "which fields does this country need" service, so for now this is our own list. The rule
 * agreed with the owner: when Verto can answer (see lib/verto-support.ts), ITS answer decides which countries can be
 * paid and which fields are needed; this list is the fallback until then.
 */
export interface BankField {
  key: "bankName" | "accountNumber" | "swiftOrRoutingCode" | "intermediaryBank";
  label: string;
  placeholder?: string;
  required: boolean;
}

const BANK_NAME: BankField = { key: "bankName", label: "Bank Name", required: true };
const ACCOUNT: BankField = { key: "accountNumber", label: "Account Number", required: true };
const SWIFT: BankField = { key: "swiftOrRoutingCode", label: "SWIFT / BIC Code", placeholder: "e.g. KCBLKENX", required: true };

/** Countries that use IBANs (the account number IS the IBAN). */
const IBAN_COUNTRIES = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","NO","CH","LI","IS",
]);

export function bankFieldsForCountry(iso2: string | null | undefined): BankField[] {
  const c = (iso2 ?? "").trim().toUpperCase();
  if (c === "US") return [BANK_NAME, ACCOUNT, { key: "swiftOrRoutingCode", label: "ABA Routing Number", placeholder: "9 digits", required: true }];
  if (c === "GB") return [BANK_NAME, ACCOUNT, { key: "swiftOrRoutingCode", label: "Sort Code", placeholder: "e.g. 12-34-56", required: true }];
  if (IBAN_COUNTRIES.has(c)) return [BANK_NAME, { ...ACCOUNT, label: "IBAN", placeholder: "Starts with your country code" }, { ...SWIFT, label: "SWIFT / BIC Code" }];
  return [BANK_NAME, ACCOUNT, SWIFT];
}

/** Returns the first missing/invalid field's message, or null when everything needed is filled in. */
export function validateBankDetails(iso2: string | null | undefined, details: Record<string, string>): string | null {
  for (const f of bankFieldsForCountry(iso2)) {
    if (f.required && !(details[f.key] ?? "").trim()) return `Enter your ${f.label}.`;
  }
  return null;
}
