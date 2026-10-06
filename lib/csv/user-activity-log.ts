/**
 * CSV export of one user's activity (audit) log, for the admin Users
 * screens. Pure and dependency-free so it can be unit-tested
 * (tests/user-activity-log-csv.test.ts). The data comes from the
 * AuditLog table written by lib/audit-log.ts; the admin-only route
 * handler is app/api/admin/users/[id]/activity-log/route.ts.
 *
 * Every cell is passed through csvCell(), which (1) neutralises CSV
 * formula injection by prefixing a leading = + - @ (or tab / carriage
 * return) with an apostrophe, so a hostile user agent string such as
 * "=HYPERLINK(...)" is never evaluated by Excel/Sheets, and (2) quotes
 * the cell when it holds a comma, quote or line break.
 */

import { changeEventLines } from "../activity-diff";

export interface ActivityLogCsvRow {
  id: string;
  action: string;
  createdAt: Date;
  metadata: unknown;
}

/** Max rows one export will contain. */
export const ACTIVITY_LOG_EXPORT_CAP = 5000;

export const ACTIVITY_LOG_ACTION_LABELS: Record<string, string> = {
  LOGIN: "Signed in",
  LOGIN_FAILED: "Failed sign-in attempt",
  PASSWORD_RESET_REQUESTED: "Requested a password reset",
  PASSWORD_RESET_COMPLETED: "Completed a password reset",
  ROLE_CHANGED: "Role changed",
  ACCOUNT_SUSPENDED: "Account suspended",
  ACCOUNT_REACTIVATED: "Account reactivated",
  DELETE_TRANSACTION: "Deleted a transaction",
  RESET_ALL_ORDERS: "Reset all orders",
  PROFILE_UPDATED: "Updated profile",
  AUTHOR_PROFILE_UPDATED: "Updated author profile",
  ADDRESS_ADDED: "Added an address",
  ADDRESS_REMOVED: "Removed an address",
  ADDRESS_DEFAULT_CHANGED: "Changed default address",
  PASSWORD_CHANGED: "Changed password",
  TWO_FACTOR_ENABLED: "Enabled two-factor authentication",
  TWO_FACTOR_UPDATED: "Updated two-factor settings",
  TWO_FACTOR_DISABLED: "Disabled two-factor authentication",
  PAYOUT_METHOD_ADDED: "Added a payout method",
  PAYOUT_METHOD_UPDATED: "Updated payout details",
  PAYOUT_METHOD_REMOVED: "Removed a payout method",
  PAYOUT_METHOD_ACTIVATED: "Changed active payout method",
};

export const ACTIVITY_LOG_CSV_HEADER = [
  "Timestamp (ISO)",
  "Event",
  "Event description",
  "Details",
  "IP address",
  "Device / user agent",
  "Performed by (admin ID)",
  "Other data (JSON)",
  "Log entry ID",
] as const;

const FORMULA_LEADERS = /^[=+\-@\t\r]/;

export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : typeof value === "string" ? value : String(value);
  if (FORMULA_LEADERS.test(s)) s = `'${s}`;
  if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

function asRecord(metadata: unknown): Record<string, unknown> {
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : {};
}

function text(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function describe(action: string, m: Record<string, unknown>): string {
  if (action === "ROLE_CHANGED" && m.fromRole && m.toRole) return `${String(m.fromRole)} -> ${String(m.toRole)}`;
  // Self-service edits: the summary line followed by one "field: old -> new"
  // per changed field (account numbers / SWIFT / phones already masked,
  // passwords etc. never carry values — see lib/activity-diff.ts).
  const lines = changeEventLines(m);
  if (lines.length) return lines.join(" | ");
  if (typeof m.summary === "string") return m.summary;
  return "";
}

const KNOWN_KEYS = new Set(["ip", "userAgent", "fromRole", "toRole", "performedBy", "summary"]);

function safeTimestamp(d: Date): string {
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

export function buildUserActivityLogCsv(rows: ActivityLogCsvRow[]): string {
  const lines = rows.map((r) => {
    const m = asRecord(r.metadata);
    const other: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(m)) if (!KNOWN_KEYS.has(k)) other[k] = v;
    const otherJson = Object.keys(other).length ? JSON.stringify(other) : "";
    return [
      safeTimestamp(r.createdAt),
      r.action,
      ACTIVITY_LOG_ACTION_LABELS[r.action] ?? r.action,
      describe(r.action, m),
      text(m.ip),
      text(m.userAgent),
      text(m.performedBy),
      otherJson,
      r.id,
    ]
      .map(csvCell)
      .join(",");
  });
  return [ACTIVITY_LOG_CSV_HEADER.map(csvCell).join(","), ...lines].join("\r\n") + "\r\n";
}

/** Filename-safe version of an account number. */
export function activityLogFilename(accountNumber: string, date: Date = new Date()): string {
  const safe = accountNumber.replace(/[^A-Za-z0-9_-]/g, "") || "user";
  return `activity-log-${safe}-${date.toISOString().slice(0, 10)}.csv`;
}
