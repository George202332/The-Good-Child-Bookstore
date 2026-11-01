import { prisma } from "@/lib/prisma";

/**
 * Creates a notification for a user. SERVER-ONLY helper: it deliberately lives here and not in a "use server" file,
 * because anything exported from a "use server" file can be called straight from a browser, which would let anyone put
 * their own text into any user's notifications.
 */
export async function createNotification(
  userId: string,
  title: string,
  body: string,
  type: string = "GENERAL",
  relatedRecordId?: string
): Promise<void> {
  try {
    await prisma.notification.create({ data: { userId, title, body, type, relatedRecordId: relatedRecordId ?? null } });
  } catch {
    // Non-critical — a failed notification shouldn't break the action that triggered it.
  }
}
