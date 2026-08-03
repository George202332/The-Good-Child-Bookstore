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

export async function createNotification(userId: string, title: string, body: string, type: string = "GENERAL"): Promise<void> {
  try {
    await prisma.notification.create({ data: { userId, title, body, type } });
  } catch {
    // Non-critical — a failed notification shouldn't break the action that triggered it.
  }
}

export interface NotificationRow {
  id: string;
  title: string;
  body: string;
  type: string;
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
    return notifications.map((n: { id: string; title: string; body: string; type: string; read: boolean; createdAt: Date }) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      type: n.type,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function markAllNotificationsRead(): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user) return { ok: false };
  try {
    await prisma.notification.updateMany({ where: { userId: session.user.id, read: false }, data: { read: true } });
    revalidatePath("/account/notifications");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** Which sidebar nav keys currently have at least one unread
 * notification pointing at them — used to blink the matching icon.
 * Returns a Set of nav keys (see notificationTypeInfo().sidebarKey). */
export async function getUnreadSidebarKeys(): Promise<Set<string>> {
  const session = await auth();
  if (!session?.user) return new Set();
  try {
    const { notificationTypeInfo } = await import("@/lib/notification-types");
    const unread = await prisma.notification.findMany({
      where: { userId: session.user.id, read: false },
      select: { type: true },
    });
    const keys = new Set<string>();
    for (const n of unread as { type: string }[]) {
      const sidebarKey = notificationTypeInfo(n.type).sidebarKey;
      if (sidebarKey) keys.add(sidebarKey);
    }
    return keys;
  } catch {
    return new Set();
  }
}

/** Marks every unread notification whose type maps to this specific
 * sidebar section as read — called with the page's own activeKey, so
 * simply visiting a section (e.g. My Books) clears that section's
 * blink without touching notifications for anything else. */
export async function markSidebarKeyNotificationsRead(sidebarKey: string): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  try {
    const { NOTIFICATION_TYPES } = await import("@/lib/notification-types");
    const matchingTypes = Object.entries(NOTIFICATION_TYPES)
      .filter(([, info]) => info.sidebarKey === sidebarKey)
      .map(([type]) => type);
    if (matchingTypes.length === 0) return;
    await prisma.notification.updateMany({
      where: { userId: session.user.id, read: false, type: { in: matchingTypes } },
      data: { read: true },
    });
  } catch {
    // Non-critical.
  }
}
