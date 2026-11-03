import { isDateString } from "@/lib/accounting/period";

/** Checks an expense form on the server. Pure, so it can be tested. Amounts become whole cents. */

export const EXPENSE_CATEGORIES = [
  "Hosting and software",
  "Payment gateway fees",
  "Marketing and advertising",
  "Legal and professional fees",
  "Bank charges",
  "Salaries and contractors",
  "Office and equipment",
  "Travel",
  "Licences and registrations",
  "Other",
];

export const MAX_RECEIPT_BYTES = 4 * 1024 * 1024;
export const RECEIPT_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

export interface ExpenseInput {
  date: string;
  monthKey: string;
  category: string;
  description: string;
  amountCents: number;
}

/** "1,234.50", "$20", "20.5" -> cents; null when it is not a positive amount with at most two decimals. */
export function parseAmountToCents(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  const t = raw.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const cents = Math.round(Number(t) * 100);
  if (!Number.isFinite(cents) || cents <= 0 || cents > 100_000_000_00) return null;
  return cents;
}

export function validateExpense(f: { date: unknown; category: unknown; description: unknown; amount: unknown }): { ok: true; value: ExpenseInput } | { ok: false; error: string } {
  if (!isDateString(f.date)) return { ok: false, error: "Please enter a valid date." };
  const category = typeof f.category === "string" ? f.category.trim() : "";
  if (category.length < 1 || category.length > 60) return { ok: false, error: "Please choose or type a category (60 characters at most)." };
  const description = typeof f.description === "string" ? f.description.trim() : "";
  if (description.length < 2 || description.length > 300) return { ok: false, error: "Please describe the expense (2 to 300 characters)." };
  const amountCents = parseAmountToCents(f.amount);
  if (amountCents === null) return { ok: false, error: "Please enter an amount above zero, with at most two decimals." };
  return { ok: true, value: { date: f.date, monthKey: monthKeyOfDate(f.date), category, description, amountCents } };
}

/** The expense month is the month in the date as typed (not shifted by time zone). */
export function monthKeyOfDate(date: string): string {
  return date.slice(0, 7);
}

export function receiptProblem(file: { name: string; type: string; size: number }): string | null {
  if (file.size <= 0) return "That receipt file is empty.";
  if (file.size > MAX_RECEIPT_BYTES) return "The receipt must be 4 MB or smaller.";
  const lower = file.name.toLowerCase();
  const byMime = RECEIPT_TYPES[file.type];
  const okExt = Object.values(RECEIPT_TYPES).some((exts) => exts.some((e) => lower.endsWith(e)));
  if (!(byMime && byMime.some((e) => lower.endsWith(e))) && !(okExt && (!file.type || file.type === "application/octet-stream"))) {
    return "The receipt must be a PDF, JPG, PNG or WebP file.";
  }
  return null;
}

/** The real type of the file, from its first bytes, so a renamed file cannot be passed off as a receipt. */
export function sniffReceiptType(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d) return "application/pdf";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}
