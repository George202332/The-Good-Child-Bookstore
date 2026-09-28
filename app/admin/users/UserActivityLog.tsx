"use client";

import type { UserActivityLogEntry } from "@/actions/users-admin";

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "Signed in",
  LOGIN_FAILED: "Failed sign-in attempt",
  PASSWORD_RESET_REQUESTED: "Requested a password reset",
  PASSWORD_RESET_COMPLETED: "Completed a password reset",
  ROLE_CHANGED: "Role changed",
  ACCOUNT_SUSPENDED: "Account suspended",
  ACCOUNT_REACTIVATED: "Account reactivated",
  DELETE_TRANSACTION: "Deleted a transaction",
  RESET_ALL_ORDERS: "Reset all orders",
};

const ACTION_COLOR: Record<string, string> = {
  LOGIN: "var(--mint-deep, #2f9e6b)",
  LOGIN_FAILED: "var(--admin-danger, #d9534f)",
  PASSWORD_RESET_REQUESTED: "var(--admin-text-faint, #999)",
  PASSWORD_RESET_COMPLETED: "var(--coral-deep, #d9662f)",
  ROLE_CHANGED: "var(--coral-deep, #d9662f)",
  ACCOUNT_SUSPENDED: "var(--admin-danger, #d9534f)",
  ACCOUNT_REACTIVATED: "var(--mint-deep, #2f9e6b)",
};

function describeMetadata(action: string, metadata: Record<string, unknown> | null): string | null {
  if (!metadata) return null;
  const parts: string[] = [];
  if (typeof metadata.ip === "string" && metadata.ip) parts.push(`IP ${metadata.ip}`);
  if (typeof metadata.userAgent === "string" && metadata.userAgent) parts.push(metadata.userAgent);
  if (action === "ROLE_CHANGED" && metadata.fromRole && metadata.toRole) {
    parts.push(`${metadata.fromRole} → ${metadata.toRole}`);
  }
  if ((action === "ACCOUNT_SUSPENDED" || action === "ACCOUNT_REACTIVATED") && typeof metadata.performedBy === "string") {
    parts.push(`by admin ${metadata.performedBy}`);
  }
  return parts.length ? parts.join(" · ") : null;
}

/**
 * The event list itself (login timestamps, IP/device info, password
 * reset events, role changes — everything lib/audit-log.ts records for
 * this account), rendered inside the full-screen popup opened from
 * UsersTable.tsx. Read-only — this is a history, nothing here is
 * editable.
 */
export function UserActivityLog({ entries }: { entries: UserActivityLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <div style={{ padding: "20px 0", color: "var(--admin-text-faint)", fontSize: 13, textAlign: "center" }}>
        No recorded activity yet for this account.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {entries.map((entry) => {
        const detail = describeMetadata(entry.action, entry.metadata);
        return (
          <div
            key={entry.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 16,
              padding: "12px 0",
              borderBottom: "1px solid var(--admin-border)",
            }}
          >
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: ACTION_COLOR[entry.action] ?? "var(--admin-text)" }}>
                {ACTION_LABELS[entry.action] ?? entry.action}
              </div>
              {detail && <div style={{ fontSize: 12, color: "var(--admin-text-faint)", marginTop: 2 }}>{detail}</div>}
            </div>
            <div style={{ fontSize: 12, color: "var(--admin-text-faint)", whiteSpace: "nowrap" }}>
              {entry.createdAt.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
