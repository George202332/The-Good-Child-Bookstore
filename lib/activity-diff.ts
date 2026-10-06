/**
 * Pure change-diff helpers behind the per-user activity log entries that
 * record a user's OWN edits to their profile, payout details, address,
 * password and two-factor settings (written through lib/audit-log.ts,
 * read by the admin activity log screen and its CSV export).
 *
 * Privacy rules enforced here, in one place, so no caller can get them
 * wrong:
 *   - "plain" fields log the old and new value (trimmed, truncated).
 *   - "masked" fields (account number, SWIFT/routing code, phone numbers)
 *     log ONLY that the field changed plus a masked tail (last 4
 *     characters) of the old and new value — never the full value.
 *   - "hidden" fields (passwords, tokens, secrets, card numbers, and
 *     private attributes such as gender or street line) log ONLY that the
 *     field changed, no values at all.
 *   - Any key whose name looks like a secret is forced to "hidden" even
 *     if a caller declared it plain.
 *   - When nothing changed the result is empty and the caller writes no
 *     log entry.
 */

export type FieldKind = "plain" | "masked" | "hidden";

export interface FieldSpec {
  key: string;
  label: string;
  kind?: FieldKind;
  /** Max characters kept of a plain value (default 120). */
  maxLen?: number;
}

export interface FieldChange {
  field: string;
  label: string;
  kind: FieldKind;
  /** Absent for "hidden" fields. Masked fields hold the masked tail. */
  from?: string;
  to?: string;
}

export type Snapshot = Record<string, unknown>;

const SECRET_KEY = /pass(word|wd|phrase)?|token|secret|cvv|cvc|card|pin\b|otp|hash/i;
const DEFAULT_MAX_LEN = 120;

/** "****1234" for any value longer than 4 characters; shorter values give
 * just "****" so a short value is never revealed in full. Empty -> "". */
export function maskTail(value: string, visible = 4): string {
  const v = value.trim();
  if (!v) return "";
  return v.length <= visible ? "****" : `****${v.slice(-visible)}`;
}

/** Canonical string form used for comparing and logging. null/undefined/""
 * are all "", arrays compare as their joined items, booleans as yes/no. */
export function normalizeValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map((x) => normalizeValue(x)).filter(Boolean).join(", ");
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v.trim();
  return "";
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}...` : s;
}

function effectiveKind(spec: FieldSpec): FieldKind {
  if (SECRET_KEY.test(spec.key)) return "hidden";
  return spec.kind ?? "plain";
}

/** Fields (from `specs`, in spec order) whose normalised value differs
 * between `before` and `after`. Keys missing from a snapshot count as
 * empty. Empty array when nothing changed. */
export function diffFields(before: Snapshot, after: Snapshot, specs: FieldSpec[]): FieldChange[] {
  const out: FieldChange[] = [];
  for (const spec of specs) {
    const a = normalizeValue(before[spec.key]);
    const b = normalizeValue(after[spec.key]);
    if (a === b) continue;
    const kind = effectiveKind(spec);
    const change: FieldChange = { field: spec.key, label: spec.label, kind };
    if (kind === "plain") {
      const max = spec.maxLen ?? DEFAULT_MAX_LEN;
      change.from = truncate(a, max);
      change.to = truncate(b, max);
    } else if (kind === "masked") {
      change.from = maskTail(a);
      change.to = maskTail(b);
    }
    out.push(change);
  }
  return out;
}

/** "Updated payout details: bank name, SWIFT / routing code changed". */
export function summarizeChanges(prefix: string, changes: FieldChange[]): string {
  const names = changes.map((c) => c.label);
  return `${prefix}: ${names.join(", ")} changed`;
}

/** One readable line for the log screen / CSV. */
export function formatChangeLine(c: FieldChange): string {
  if (c.kind === "hidden") return `${c.label}: changed (value not recorded)`;
  const from = c.from ? c.from : "(empty)";
  const to = c.to ? c.to : "(empty)";
  if (c.kind === "masked") return `${c.label}: ${from} -> ${to} (masked)`;
  return `${c.label}: "${from}" -> "${to}"`;
}

/** Event metadata for a "fields changed" entry, or null when there is
 * nothing to log (so callers can skip writing an entry). */
export function buildChangeMetadata(
  prefix: string,
  changes: FieldChange[],
  extra?: Record<string, unknown>
): Record<string, unknown> | null {
  if (changes.length === 0) return null;
  return { ...(extra ?? {}), summary: summarizeChanges(prefix, changes), changes };
}

function isChange(v: unknown): v is FieldChange {
  return !!v && typeof v === "object" && typeof (v as FieldChange).label === "string" && typeof (v as FieldChange).kind === "string";
}

/** Reads back the summary + per-field lines from stored metadata. Tolerant
 * of anything (older rows, hand-edited JSON): returns [] when there is
 * no recognisable change data. The first element is the summary. */
export function changeEventLines(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const m = metadata as Record<string, unknown>;
  const lines: string[] = [];
  if (typeof m.summary === "string" && m.summary) lines.push(m.summary);
  if (Array.isArray(m.changes)) {
    for (const c of m.changes) if (isChange(c)) lines.push(formatChangeLine(c));
  }
  return lines;
}

// ---------------------------------------------------------------------
// Field definitions per area
// ---------------------------------------------------------------------

export const ACCOUNT_PROFILE_FIELDS: FieldSpec[] = [
  { key: "name", label: "name" },
  { key: "email", label: "email" },
  { key: "country", label: "country" },
  { key: "preferredFormat", label: "preferred format" },
  { key: "shoppingForAgeRanges", label: "shopping age ranges" },
];

export const AUTHOR_PROFILE_FIELDS: FieldSpec[] = [
  { key: "bio", label: "bio", maxLen: 80 },
  { key: "penName", label: "pen name" },
  { key: "primaryGenre", label: "primary genre" },
  { key: "pressKitUrl", label: "press kit URL" },
  { key: "socialLinks", label: "social links" },
  { key: "availableForCollabs", label: "available for collaborations" },
  { key: "showEmailPublicly", label: "show email publicly" },
  { key: "gender", label: "gender", kind: "hidden" },
];

export const PAYOUT_METHOD_FIELDS: FieldSpec[] = [
  { key: "accountHolderName", label: "account holder name" },
  { key: "currency", label: "payout currency" },
  { key: "bankName", label: "bank name" },
  { key: "accountNumber", label: "account number", kind: "masked" },
  { key: "swiftOrRoutingCode", label: "SWIFT / routing code", kind: "masked" },
  { key: "country", label: "bank country" },
  { key: "intermediaryBank", label: "intermediary bank" },
  { key: "paypalEmail", label: "PayPal email" },
  { key: "mpesaPhone", label: "M-Pesa phone number", kind: "masked" },
];

export const TWO_FACTOR_FIELDS: FieldSpec[] = [
  { key: "enabled", label: "two-factor enabled" },
  { key: "method", label: "two-factor method" },
  { key: "phoneNumber", label: "two-factor phone number", kind: "masked" },
];

export const ADDRESS_FIELDS: FieldSpec[] = [
  { key: "label", label: "label" },
  { key: "line", label: "street address", kind: "hidden" },
  { key: "city", label: "city" },
  { key: "country", label: "country" },
];

// ---------------------------------------------------------------------
// Payout recipient snapshot (same key lists the admin readers use:
// actions/users-admin-details.ts and lib/recipient-bank-details.ts)
// ---------------------------------------------------------------------

function pickKey(d: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = d[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return "";
}

export interface PayoutRecipientLike {
  type: string;
  currency: string;
  accountHolderName: string;
  details: unknown;
}

/** Flattens a WiseRecipient (type + currency + holder + details JSON)
 * into the keys of PAYOUT_METHOD_FIELDS. */
export function payoutSnapshot(r: PayoutRecipientLike): Snapshot {
  const d = (r.details && typeof r.details === "object" && !Array.isArray(r.details) ? r.details : {}) as Record<string, unknown>;
  return {
    accountHolderName: r.accountHolderName,
    currency: r.currency.toUpperCase(),
    bankName: pickKey(d, ["bankName"]),
    accountNumber: pickKey(d, ["accountNumber", "account_number", "iban"]),
    swiftOrRoutingCode: pickKey(d, ["swiftOrRoutingCode", "swiftCode", "swift_code", "routingNumber", "routing_number", "sortCode", "sort_code"]),
    country: pickKey(d, ["country"]),
    intermediaryBank: pickKey(d, ["intermediaryBank"]),
    paypalEmail: r.type === "email" ? pickKey(d, ["email"]) : "",
    mpesaPhone: r.type === "mpesa" ? pickKey(d, ["phoneNumber"]) : "",
  };
}
