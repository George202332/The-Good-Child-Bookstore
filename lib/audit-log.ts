import { prisma } from "@/lib/prisma";
import { getRequestIp, getRequestUserAgent } from "@/lib/geo";

/**
 * The single place every user-activity event is written from — logins,
 * password resets, and role changes (see the admin Users activity log,
 * app/admin/users/UserActivityLog.tsx). `actorId` is the account the
 * event happened TO (the person who logged in, whose password was
 * reset, whose role changed) so a lookup by user id returns everything
 * relevant to them, even when an admin caused the change (the admin who
 * made the change, if any, goes in `metadata.performedBy`).
 *
 * Never throws — logging an event is never allowed to fail the real
 * action (a login, a password reset) it's attached to.
 */
export type AuditAction =
  | "LOGIN"
  | "LOGIN_FAILED"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET_COMPLETED"
  | "ROLE_CHANGED"
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_REACTIVATED"
  | "DELETE_TRANSACTION"
  | "RESET_ALL_ORDERS"
  // Self-service edits the user made to their OWN account (see
  // lib/activity-diff.ts for what is and is not recorded in the metadata).
  | "PROFILE_UPDATED"
  | "AUTHOR_PROFILE_UPDATED"
  | "ADDRESS_ADDED"
  | "ADDRESS_REMOVED"
  | "ADDRESS_DEFAULT_CHANGED"
  | "PASSWORD_CHANGED"
  | "TWO_FACTOR_ENABLED"
  | "TWO_FACTOR_UPDATED"
  | "TWO_FACTOR_DISABLED"
  | "PAYOUT_METHOD_ADDED"
  | "PAYOUT_METHOD_UPDATED"
  | "PAYOUT_METHOD_REMOVED"
  | "PAYOUT_METHOD_ACTIVATED"
  // A writer withdrawing / deleting their own blog post.
  | "BLOG_WITHDRAWN"
  | "BLOG_DELETED";

export async function logAuditEvent(actorId: string, action: AuditAction, metadata?: Record<string, unknown>): Promise<void> {
  try {
    await prisma.auditLog.create({ data: { actorId, action, metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined } });
  } catch {
    // Best-effort — a logging failure must never block the real action.
  }
}

/**
 * logAuditEvent plus the requesting IP and user agent, for events the
 * user caused themselves from a signed-in request (profile/payout/security
 * edits). Same never-throws guarantee: reading the request headers or
 * writing the row can fail and the real save is unaffected. Awaited by
 * callers (not left dangling) so a serverless runtime can't cut the write
 * short.
 */
export async function logSelfServiceEvent(actorId: string, action: AuditAction, metadata?: Record<string, unknown> | null): Promise<void> {
  try {
    if (metadata === null) return; // nothing changed — no entry
    const ip = await getRequestIp();
    const userAgent = await getRequestUserAgent();
    await logAuditEvent(actorId, action, { ...(metadata ?? {}), ip, userAgent });
  } catch {
    // Best-effort — never block the save.
  }
}
