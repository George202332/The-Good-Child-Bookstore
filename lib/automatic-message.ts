import { prisma } from "@/lib/prisma";
import { setMessageMeta } from "@/lib/message-meta";
import { createNotification } from "@/lib/notify";
import type { DepartmentKey } from "@/lib/message-departments";
import type { BookRef } from "@/lib/book-reference";

/**
 * SERVER-ONLY: the system sends a user a message by itself (for example a failed payout). It appears in their Messages
 * page from the Support Team with the department badge and a small "Automatic" tag, and also as a notification.
 * Never throws: a failed message must not break the action that triggered it.
 */
export async function sendAutomaticMessage(userId: string, department: DepartmentKey, subject: string, body: string, book?: BookRef): Promise<string | null> {
  try {
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true } });
    if (!admin || admin.id === userId) return null;
    const category = department === "PAYOUTS" || department === "ACCOUNTING" ? "PAYMENTS" : null;
    const m = await prisma.message.create({ data: { senderId: admin.id, recipientId: userId, body, category }, select: { id: true } });
    await setMessageMeta(m.id, { department, subject, automatic: true, ...(book ? { book } : {}) });
    await createNotification(userId, subject, body.slice(0, 140), "MESSAGE");
    return m.id;
  } catch {
    return null;
  }
}
