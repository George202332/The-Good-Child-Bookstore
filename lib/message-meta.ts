import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DepartmentKey } from "@/lib/message-departments";

/**
 * The department / subject / thread / automatic columns of a message.
 * Raw SQL, and every call is guarded, so messaging keeps working on the old database until the migration is run.
 */
export interface MessageMeta { department: string | null; subject: string | null; threadId: string | null; automatic: boolean }

export async function setMessageMeta(id: string, meta: { department?: DepartmentKey | null; subject?: string | null; threadId?: string | null; automatic?: boolean }): Promise<void> {
  try {
    await prisma.$executeRaw(
      Prisma.sql`UPDATE "Message" SET "department" = ${meta.department ?? null}, "subject" = ${meta.subject ?? null}, "threadId" = ${meta.threadId ?? null}, "automatic" = ${meta.automatic ?? false} WHERE id = ${id}`
    );
  } catch {
    // Not critical: the message itself is saved.
  }
}

export async function getMessageMeta(ids: string[]): Promise<Map<string, MessageMeta>> {
  const out = new Map<string, MessageMeta>();
  if (ids.length === 0) return out;
  try {
    const rows = await prisma.$queryRaw<{ id: string; department: string | null; subject: string | null; threadId: string | null; automatic: boolean }[]>(
      Prisma.sql`SELECT id, "department", "subject", "threadId", "automatic" FROM "Message" WHERE id IN (${Prisma.join(ids)})`
    );
    for (const r of rows) out.set(r.id, { department: r.department, subject: r.subject, threadId: r.threadId, automatic: r.automatic });
  } catch {
    // Old database: no meta, plain messages.
  }
  return out;
}
