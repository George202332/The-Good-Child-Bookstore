"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Direct messages between any two account holders — a reader asking an
 * author a question, an affiliate coordinating a promotion, etc. Simple
 * by design: one flat Message table, conversations are just "everything
 * between me and one other person," no threading/subjects. Now split
 * into Inbox / Sent / Drafts, with drafts being real saved-but-unsent
 * messages (see Message.isDraft) rather than anything client-only.
 */

export interface ConversationRow {
  counterpartId: string;
  counterpartName: string;
  lastMessage: string;
  lastMessageAt: Date;
  unread: boolean;
}

/** Inbox conversations — real (non-draft) messages only, grouped by
 * whoever you've exchanged messages with, newest first. */
export async function listConversations(): Promise<ConversationRow[]> {
  const session = await auth();
  if (!session?.user) return [];

  try {
    const messages = await prisma.message.findMany({
      where: { isDraft: false, OR: [{ senderId: session.user.id }, { recipientId: session.user.id }] },
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

export interface SentMessageRow {
  id: string;
  recipientId: string;
  recipientName: string;
  body: string;
  createdAt: Date;
  read: boolean;
}

/** Every real message you've sent, individually (not grouped) — newest
 * first, so you can see exactly what you sent and when. */
export async function listSentMessages(): Promise<SentMessageRow[]> {
  const session = await auth();
  if (!session?.user) return [];

  try {
    const messages = await prisma.message.findMany({
      where: { senderId: session.user.id, isDraft: false },
      include: { recipient: true },
      orderBy: { createdAt: "desc" },
    });
    return (messages as { id: string; recipientId: string; recipient: { name: string }; body: string; createdAt: Date; readAt: Date | null }[]).map((m) => ({
      id: m.id,
      recipientId: m.recipientId,
      recipientName: m.recipient.name,
      body: m.body,
      createdAt: m.createdAt,
      read: !!m.readAt,
    }));
  } catch {
    return [];
  }
}

export interface DraftMessageRow {
  id: string;
  recipientId: string;
  recipientName: string;
  body: string;
  createdAt: Date;
}

/** Saved-but-unsent messages — a real, persistent draft, not anything
 * stored only in the browser. */
export async function listDraftMessages(): Promise<DraftMessageRow[]> {
  const session = await auth();
  if (!session?.user) return [];

  try {
    const drafts = await prisma.message.findMany({
      where: { senderId: session.user.id, isDraft: true },
      include: { recipient: true },
      orderBy: { createdAt: "desc" },
    });
    return (drafts as { id: string; recipientId: string; recipient: { name: string }; body: string; createdAt: Date }[]).map((m) => ({
      id: m.id,
      recipientId: m.recipientId,
      recipientName: m.recipient.name,
      body: m.body,
      createdAt: m.createdAt,
    }));
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
        isDraft: false,
        OR: [
          { senderId: session.user.id, recipientId: counterpartId },
          { senderId: counterpartId, recipientId: session.user.id },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    // Mark incoming messages as read.
    await prisma.message.updateMany({
      where: { senderId: counterpartId, recipientId: session.user.id, readAt: null, isDraft: false },
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
  const { createNotification } = await import("@/actions/notifications");
  await createNotification(recipientId, `New message from ${session.user.name}`, body.trim().slice(0, 140), "MESSAGE");
  revalidatePath("/account/messages");
  revalidatePath(`/account/messages/${recipientId}`);
  return { ok: true };
}

/** Saves a draft for later — same shape as sendMessage, but marked
 * isDraft so it never reaches the recipient. */
export async function saveDraft(recipientId: string, body: string): Promise<{ ok: boolean; error?: string; draftId?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "You need to be signed in." };
  if (!recipientId) return { ok: false, error: "Choose who this draft is for." };
  if (!body.trim()) return { ok: false, error: "Draft can't be empty." };

  const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
  if (!recipient) return { ok: false, error: "Recipient not found." };

  const draft = await prisma.message.create({
    data: { senderId: session.user.id, recipientId, body: body.trim(), isDraft: true },
  });
  revalidatePath("/account/messages");
  return { ok: true, draftId: draft.id };
}

/** Updates an existing draft's text/recipient without sending it. */
export async function updateDraft(draftId: string, recipientId: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "You need to be signed in." };

  const draft = await prisma.message.findUnique({ where: { id: draftId } });
  if (!draft || draft.senderId !== session.user.id || !draft.isDraft) return { ok: false, error: "Draft not found." };
  if (!body.trim()) return { ok: false, error: "Draft can't be empty." };

  await prisma.message.update({ where: { id: draftId }, data: { recipientId, body: body.trim() } });
  revalidatePath("/account/messages");
  return { ok: true };
}

/** Actually sends a saved draft — turns it into a real sent message. */
export async function sendDraft(draftId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "You need to be signed in." };

  const draft = await prisma.message.findUnique({ where: { id: draftId } });
  if (!draft || draft.senderId !== session.user.id || !draft.isDraft) return { ok: false, error: "Draft not found." };
  if (!draft.body.trim()) return { ok: false, error: "Draft can't be empty." };

  await prisma.message.update({ where: { id: draftId }, data: { isDraft: false, createdAt: new Date() } });
  const { createNotification } = await import("@/actions/notifications");
  const sender = await prisma.user.findUnique({ where: { id: session.user.id } });
  await createNotification(draft.recipientId, `New message from ${sender?.name ?? "someone"}`, draft.body.trim().slice(0, 140), "MESSAGE");
  revalidatePath("/account/messages");
  revalidatePath(`/account/messages/${draft.recipientId}`);
  return { ok: true };
}

export async function deleteDraft(draftId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "You need to be signed in." };

  const draft = await prisma.message.findUnique({ where: { id: draftId } });
  if (!draft || draft.senderId !== session.user.id || !draft.isDraft) return { ok: false, error: "Draft not found." };

  await prisma.message.delete({ where: { id: draftId } });
  revalidatePath("/account/messages");
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
