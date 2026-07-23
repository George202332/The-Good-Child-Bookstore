"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Direct messages between any two account holders — a reader asking an
 * author a question, an affiliate coordinating a promotion, etc. Simple
 * by design: one flat Message table, conversations are just "everything
 * between me and one other person," no threading/subjects.
 */

export interface ConversationRow {
  counterpartId: string;
  counterpartName: string;
  lastMessage: string;
  lastMessageAt: Date;
  unread: boolean;
}

export async function listConversations(): Promise<ConversationRow[]> {
  const session = await auth();
  if (!session?.user) return [];

  try {
    const messages = await prisma.message.findMany({
      where: { OR: [{ senderId: session.user.id }, { recipientId: session.user.id }] },
      include: { sender: true, recipient: true },
      orderBy: { createdAt: "desc" },
    });

    const byCounterpart = new Map<string, ConversationRow>();
    for (const m of messages as {
      senderId: string;
      recipientId: string;
      body: string;
      createdAt: Date;
      readAt: Date | null;
      sender: { name: string };
      recipient: { name: string };
    }[]) {
      const isMine = m.senderId === session.user.id;
      const counterpartId = isMine ? m.recipientId : m.senderId;
      if (byCounterpart.has(counterpartId)) continue; // messages are ordered desc, so first hit is the latest
      byCounterpart.set(counterpartId, {
        counterpartId,
        counterpartName: isMine ? m.recipient.name : m.sender.name,
        lastMessage: m.body,
        lastMessageAt: m.createdAt,
        unread: !isMine && !m.readAt,
      });
    }
    return Array.from(byCounterpart.values());
  } catch {
    return [];
  }
}

export interface MessageRow {
  id: string;
  body: string;
  createdAt: Date;
  fromMe: boolean;
}

export async function listMessagesWith(counterpartId: string): Promise<MessageRow[]> {
  const session = await auth();
  if (!session?.user) return [];

  try {
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: session.user.id, recipientId: counterpartId },
          { senderId: counterpartId, recipientId: session.user.id },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    // Mark incoming messages as read.
    await prisma.message.updateMany({
      where: { senderId: counterpartId, recipientId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    });

    return (messages as { id: string; body: string; createdAt: Date; senderId: string }[]).map((m) => ({
      id: m.id,
      body: m.body,
      createdAt: m.createdAt,
      fromMe: m.senderId === session.user.id,
    }));
  } catch {
    return [];
  }
}

export async function sendMessage(recipientId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "You need to be signed in." };
  if (!body.trim()) return { ok: false, error: "Message can't be empty." };
  if (recipientId === session.user.id) return { ok: false, error: "You can't message yourself." };

  const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
  if (!recipient) return { ok: false, error: "Recipient not found." };

  await prisma.message.create({
    data: { senderId: session.user.id, recipientId, body: body.trim() },
  });
  revalidatePath("/account/messages");
  revalidatePath(`/account/messages/${recipientId}`);
  return { ok: true };
}

/** Looks up a user id by name/email, for starting a new conversation —
 * used by the "New message" form. */
export async function findUserToMessage(query: string): Promise<{ id: string; name: string; role: string }[]> {
  const session = await auth();
  if (!session?.user || !query.trim()) return [];

  const users = await prisma.user.findMany({
    where: {
      id: { not: session.user.id },
      OR: [{ name: { contains: query, mode: "insensitive" } }, { email: { contains: query, mode: "insensitive" } }],
    },
    take: 8,
  });
  return users.map((u: { id: string; name: string; role: string }) => ({ id: u.id, name: u.name, role: u.role }));
}
