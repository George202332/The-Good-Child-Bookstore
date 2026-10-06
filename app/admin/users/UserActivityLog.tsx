"use client";

import type { UserActivityLogEntry } from "@/actions/users-admin";
import { ACTIVITY_LOG_ACTION_LABELS } from "@/lib/csv/user-activity-log";
import { changeEventLines } from "@/lib/activity-diff";

const ACTION_LABELS = ACTIVITY_LOG_ACTION_LABELS;

const ACTION_COLOR: Record<string, string> = {
  LOGIN: "var(--mint-deep, #2f9e6b)",
  LOGIN_FAILED: "var(--admin-danger, #d9534f)",
  PASSWORD_RESET_REQUESTED: "var(--admin-text-faint, #999)",
  PASSWORD_RESET_COMPLETED: "var(--coral-deep, #d9662f)",
  ROLE_CHANGED: "var(--coral-deep, #d9662f)",
  ACCOUNT_SUSPENDED: "var(--admin-danger, #d9534f)",
  ACCOUNT_REACTIVATED: "var(--mint-deep, #2f9e6b)",
  PASSWORD_CHANGED: "var(--coral-deep, #d9662f)",
  TWO_FACTOR_DISABLED: "var(--admin-danger, #d9534f)",
  TWO_FACTOR_ENABLED: "var(--mint-deep, #2f9e6b)",
  PAYOUT_METHOD_REMOVED: "var(--admin-danger, #d9534f)",
  PAYOUT_METHOD_UPDATED: "var(--coral-deep, #d9662f)",
  PAYOUT_METHOD_ADDED: "var(--coral-deep, #d9662f)",
  PAYOUT_METHOD_ACTIVATED: "var(--coral-deep, #d9662f)",
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
export function UserActivityLog({ entries, userId }: { entries: UserActivityLogEntry[]; userId?: string }) {
  // When a userId is given, a Download CSV button is shown. It calls the
  // admin-only route handler, which exports the FULL log (up to 5,000
  // rows), not just the entries shown here.
  const download = userId ? (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
      <a
        className="btn btn-ghost btn-small"
        href={`/api/admin/users/${encodeURIComponent(userId)}/activity-log`}
        download
      >
        Download CSV
      </a>
    </div>
  ) : null;

  if (entries.length === 0) {
    return (
      <div>
        {download}
        <div style={{ padding: "20px 0", color: "var(--admin-text-faint)", fontSize: 13, textAlign: "center" }}>
          No recorded activity yet for this account.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {download}
      {entries.map((entry) => {
        const detail = describeMetadata(entry.action, entry.metadata);
        const changeLines = changeEventLines(entry.metadata);
        // Self-service entries: summary + field lines. Fall back to a plain
        // summary for events that carry no field diff (e.g. password change).
        const summary = changeLines.length === 0 && typeof entry.metadata?.summary === "string" ? entry.metadata.summary : null;
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
              {changeLines.map((line, i) => (
                <div key={i} style={{ fontSize: 12.5, color: i === 0 ? "var(--admin-text)" : "var(--admin-text-faint)", marginTop: 2, wordBreak: "break-word" }}>{line}</div>
              ))}
              {summary && <div style={{ fontSize: 12.5, color: "var(--admin-text)", marginTop: 2 }}>{summary}</div>}
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
