"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authAdmin } from "@/lib/auth-admin";
import { sendEmail } from "@/lib/email";
import { BACKEND_ROLES, type Role } from "@/lib/roles";
import type { SupportCategory } from "@/lib/support-categories";

/**
 * The admin backend's Messages tab — mirrors the author-side Messages
 * tab (app/account/messages), but reads a pooled inbox: every message
 * any reader/author has ever sent to ANY backend account, grouped by
 * that reader/author, regardless of which specific admin the message
 * technically named as recipientId. Any Admin who opens this tab sees
 * the same shared inbox and can reply to any thread.
 *
 * A reply here does double duty, per George's requirement: it's saved
 * as a normal Message row from the replying admin to that user (so it
 * shows up in that user's own account Messages tab exactly like any
 * other message they've received), and it's also emailed straight to
 * that user's real email address.
 */

export interface AdminConversationRow {
  counterpartId: string;
  counterpartName: string;
  counterpartRole: string;
  lastMessage: string;
  lastMessageAt: Date;
  category: SupportCategory | null;
  unread: boolean;
}

async function requireAdminSession() {
  const session = await authAdmin();
  if (!session?.user || session.user.role !== "ADMIN") return null;
  return session;
}

export async function listAdminConversations(): Promise<AdminConversationRow[]> {
  const session = await requireAdminSession();
  if (!session) return [];

  try {
    const messages = await prisma.message.findMany({
      where: {
        isDraft: false,
        OR: [
          { recipient: { role: { in: BACKEND_ROLES } } },
          { sender: { role: { in: BACKEND_ROLES } } },
        ],
      },
      include: { sender: true, recipient: true },
      orderBy: { createdAt: "desc" },
    });

    const byCounterpart = new Map<string, AdminConversationRow>();
    for (const m of messages as {
      senderId: string;
      recipientId: string;
      body: string;
      createdAt: Date;
      readAt: Date | null;
      category: string | null;
      sender: { name: string; role: string };
      recipient: { name: string; role: string };
    }[]) {
      // The "counterpart" from the backend's point of view is whichever
      // side of this message ISN'T a backend account — the reader or
      // author. A message where both sides happen to be backend
      // accounts (shouldn't normally occur here) is skipped.
      const senderIsBackend = BACKEND_ROLES.includes(m.sender.role as Role);
      const recipientIsBackend = BACKEND_ROLES.includes(m.recipient.role as Role);
      if (senderIsBackend === recipientIsBackend) continue;

      const counterpartId = senderIsBackend ? m.recipientId : m.senderId;
      const counterpartName = senderIsBackend ? m.recipient.name : m.sender.name;
      const counterpartRole = senderIsBackend ? m.recipient.role : m.sender.role;
      if (byCounterpart.has(counterpartId)) continue; // newest first, so the first hit per counterpart is the latest

      byCounterpart.set(counterpartId, {
        counterpartId,
        counterpartName,
        counterpartRole,
        lastMessage: m.body,
        lastMessageAt: m.createdAt,
        category: (m.category as SupportCategory | null) ?? null,
        unread: !senderIsBackend && !m.readAt,
      });
    }
    return Array.from(byCounterpart.values());
  } catch {
    return [];
  }
}

export interface AdminMessageRow {
  id: string;
  body: string;
  createdAt: Date;
  fromSupport: boolean;
  category: SupportCategory | null;
}

/** Every message exchanged with one specific reader/author, from
 * either side of the pooled backend inbox — the same conversation any
 * Admin opening this thread sees, however many different admin
 * accounts might have taken part in it. */
export async function listAdminThread(counterpartId: string): Promise<AdminMessageRow[]> {
  const session = await requireAdminSession();
  if (!session) return [];

  try {
    const messages = await prisma.message.findMany({
      where: {
        isDraft: false,
        OR: [
          { senderId: counterpartId, recipient: { role: { in: BACKEND_ROLES } } },
          { recipientId: counterpartId, sender: { role: { in: BACKEND_ROLES } } },
        ],
      },
      include: { sender: true },
      orderBy: { createdAt: "asc" },
    });

    await prisma.message.updateMany({
      where: { senderId: counterpartId, recipient: { role: { in: BACKEND_ROLES } }, readAt: null, isDraft: false },
      data: { readAt: new Date() },
    });

    return (messages as { id: string; body: string; createdAt: Date; category: string | null; sender: { role: string } }[]).map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt,
      fromSupport: BACKEND_ROLES.includes(m.sender.role as Role),
      category: (m.category as SupportCategory | null) ?? null,
    }));
  } catch {
    return [];
  }
}

/** Sends the logged-in admin's reply — saved as a real Message (from
 * this admin, to the reader/author) so it appears in that user's own
 * account Messages tab exactly like any other message, and emailed
 * directly to that user's address at the same time. */
export async function sendAdminReply(counterpartId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdminSession();
  if (!session) return { ok: false, error: "Not authorized." };
  if (!body.trim()) return { ok: false, error: "Message can't be empty." };

  const counterpart = await prisma.user.findUnique({ where: { id: counterpartId } });
  if (!counterpart) return { ok: false, error: "Account not found." };

  await prisma.message.create({
    data: { senderId: session.user.id, recipientId: counterpartId, body: body.trim() },
  });

  const { createNotification } = await import("@/actions/notifications");
  await createNotification(counterpartId, `New message from ${session.user.name}`, body.trim().slice(0, 140), "MESSAGE");

  await sendEmail(
    counterpart.email,
    `New reply from ${session.user.name} at The Good Child Bookstore`,
    `<p>Hi ${counterpart.name},</p><p style="white-space: pre-wrap;">${body.trim()}</p><p>You can reply from your account's Messages tab, or just reply to this email.</p>`,
    undefined,
    process.env.SUPPORT_INBOX_EMAIL || "support@thegoodchildbookstore.com"
  ).catch(() => {});

  revalidatePath("/admin/messages");
  revalidatePath(`/admin/messages/${counterpartId}`);
  revalidatePath("/account/messages");
  return { ok: true };
}
