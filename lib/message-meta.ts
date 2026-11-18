import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DepartmentKey } from "@/lib/message-departments";

/**
 * The department / subject / thread / automatic columns of a message.
 * Raw SQL, and every call is guarded, so messaging keeps working on the old database until the migration is run.
 */
export interface MessageMeta {
  department: string | null; subject: string | null; threadId: string | null; automatic: boolean;
  bookId: string | null; bookTitle: string | null; bookSn: string | null;
  /** NEW, IN_PROGRESS or RESOLVED (staff side). */
  workflowStatus: "NEW" | "IN_PROGRESS" | "RESOLVED";
}
export type WorkflowStatus = MessageMeta["workflowStatus"];
export const WORKFLOW_LABELS: Record<WorkflowStatus, string> = { NEW: "New", IN_PROGRESS: "In Progress", RESOLVED: "Resolved" };

export async function setMessageMeta(id: string, meta: { department?: DepartmentKey | null; subject?: string | null; threadId?: string | null; automatic?: boolean; book?: { id: string; title: string; sn: string } | null }): Promise<void> {
  try {
    await prisma.$executeRaw(
      Prisma.sql`UPDATE "Message" SET "department" = ${meta.department ?? null}, "subject" = ${meta.subject ?? null}, "threadId" = ${meta.threadId ?? null}, "automatic" = ${meta.automatic ?? false} WHERE id = ${id}`
    );
  } catch {
    // Not critical: the message itself is saved.
  }
  // The book columns come from the second migration, so they are written on their own and never break the rest.
  if (meta.book !== undefined) {
    try {
      await prisma.$executeRaw(
        Prisma.sql`UPDATE "Message" SET "bookId" = ${meta.book?.id ?? null}, "bookTitle" = ${meta.book?.title ?? null}, "bookSn" = ${meta.book?.sn ?? null} WHERE id = ${id}`
      );
    } catch {
      // Old database: the message goes without a book reference.
    }
  }
}

/** Staff only (callers check the department first). Messages are never deleted: Resolved is just a status. */
export async function setWorkflowStatus(ids: string[], status: WorkflowStatus): Promise<boolean> {
  if (ids.length === 0) return true;
  try {
    await prisma.$executeRaw(Prisma.sql`UPDATE "Message" SET "workflowStatus" = ${status} WHERE id IN (${Prisma.join(ids)})`);
    return true;
  } catch {
    return false;
  }
}

export async function getMessageMeta(ids: string[]): Promise<Map<string, MessageMeta>> {
  const out = new Map<string, MessageMeta>();
  if (ids.length === 0) return out;
  const blank = { bookId: null, bookTitle: null, bookSn: null, workflowStatus: "NEW" as WorkflowStatus };
  try {
    const rows = await prisma.$queryRaw<{ id: string; department: string | null; subject: string | null; threadId: string | null; automatic: boolean; bookId: string | null; bookTitle: string | null; bookSn: string | null; workflowStatus: string }[]>(
      Prisma.sql`SELECT id, "department", "subject", "threadId", "automatic", "bookId", "bookTitle", "bookSn", "workflowStatus" FROM "Message" WHERE id IN (${Prisma.join(ids)})`
    );
    for (const r of rows) out.set(r.id, { department: r.department, subject: r.subject, threadId: r.threadId, automatic: r.automatic, bookId: r.bookId, bookTitle: r.bookTitle, bookSn: r.bookSn, workflowStatus: (["NEW", "IN_PROGRESS", "RESOLVED"].includes(r.workflowStatus) ? r.workflowStatus : "NEW") as WorkflowStatus });
    return out;
  } catch {
    // The second migration is not run yet: fall back to the first migration's columns.
  }
  try {
    const rows = await prisma.$queryRaw<{ id: string; department: string | null; subject: string | null; threadId: string | null; automatic: boolean }[]>(
      Prisma.sql`SELECT id, "department", "subject", "threadId", "automatic" FROM "Message" WHERE id IN (${Prisma.join(ids)})`
    );
    for (const r of rows) out.set(r.id, { department: r.department, subject: r.subject, threadId: r.threadId, automatic: r.automatic, ...blank });
  } catch {
    // Old database: no meta, plain messages.
  }
  return out;
}
