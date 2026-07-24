"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Real notifications — the Notification table existed in the schema
 * from the start but was never wired to anything. This connects it:
 * a handful of key events (order confirmed, payout approved, book/blog
 * approved) create a real notification, and this page lists/reads them.
 * Present for all three converted roles (Reader, Author, Affiliate),
 * matching the original's per-role sidebar.
 */

export async function createNotification(userId: string, title: string, body: string): Promise<void> {
  try {
    await prisma.notification.create({ data: { userId, title, body } });
  } catch {
    // Non-critical — a failed notification shouldn't break the action that triggered it.
  }
}

export interface NotificationRow {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export async function listMyNotifications(): Promise<NotificationRow[]> {
  const session = await auth();
  if (!session?.user) return [];
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return notifications.map((n: { id: string; title: string; body: string; read: boolean; createdAt: Date }) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function getUnreadNotificationCount(): Promise<number> {
  const session = await auth();
  if (!session?.user) return 0;
  try {
    return await prisma.notification.count({ where: { userId: session.user.id, read: false } });
  } catch {
    return 0;
  }
}

export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user) return { ok: false };
  await prisma.notification.updateMany({ where: { userId: session.user.id, read: false }, data: { read: true } });
  revalidatePath("/account/notifications");
  return { ok: true };
}
