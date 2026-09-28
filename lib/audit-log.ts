import { prisma } from "@/lib/prisma";

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
  | "RESET_ALL_ORDERS";

export async function logAuditEvent(actorId: string, action: AuditAction, metadata?: Record<string, unknown>): Promise<void> {
  try {
    await prisma.auditLog.create({ data: { actorId, action, metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined } });
  } catch {
    // Best-effort — a logging failure must never block the real action.
  }
}
