"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { BACKEND_ROLES } from "@/lib/roles";
import { sendEmail } from "@/lib/email";
import { SUPPORT_CATEGORIES, type SupportCategory } from "@/lib/support-categories";
import { DEPARTMENTS, categoryForDepartment, departmentForCategory, departmentOf, type DepartmentKey } from "@/lib/message-departments";
import { getMessageMeta, setMessageMeta } from "@/lib/message-meta";

const SUPPORT_INBOX = process.env.SUPPORT_INBOX_EMAIL || "support@thegoodchildbookstore.com";

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
  /** Set when the draft is a message to one of our departments. */
  department: string | null;
  subject: string | null;
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
    const meta = await getMessageMeta(drafts.map((d: { id: string }) => d.id));
    return (drafts as { id: string; recipientId: string; recipient: { name: string }; body: string; createdAt: Date }[]).map((m) => ({
      id: m.id,
      recipientId: m.recipientId,
      recipientName: m.recipient.name,
      body: m.body,
      createdAt: m.createdAt,
      department: meta.get(m.id)?.department ?? null,
      subject: meta.get(m.id)?.subject ?? null,
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

/** The fixed "Contact Support" target shown on the Messages tab's
 * compose form — resolves to the platform's longest-standing Admin
 * account, but the admin backend's own Messages tab (see
 * actions/admin-messages.ts) pools every message sent to ANY backend
 * account into one shared inbox, so which specific admin this resolves
 * to doesn't determine who can see or answer it. Displayed as "Support
 * Team" rather than that admin's personal name — a reader/author
 * contacting support shouldn't need to know which staff member that is. */
export async function getSupportRecipient(): Promise<{ id: string; name: string } | null> {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!admin) return null;
  return { id: admin.id, name: "Support Team" };
}

export async function sendMessage(recipientId: string, body: string, category?: SupportCategory, extra?: { department?: DepartmentKey; subject?: string }): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (extra?.department && !DEPARTMENTS.some((d) => d.key === extra.department)) return { ok: false, error: "Choose a department." };
  if (extra?.department && !category) category = categoryForDepartment(extra.department);
  if (!session?.user) return { ok: false, error: "You need to be signed in." };
  if (!body.trim()) return { ok: false, error: "Message can't be empty." };
  if (recipientId === session.user.id) return { ok: false, error: "You can't message yourself." };

  const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
  if (!recipient) return { ok: false, error: "Recipient not found." };

  const isSupportMessage = BACKEND_ROLES.includes(recipient.role);
  // The category picker only needs answering once per support thread —
  // this is the very first message this sender has ever sent this
  // recipient, so there's no earlier category to fall back on.
  const priorMessageCount = isSupportMessage
    ? await prisma.message.count({ where: { senderId: session.user.id, recipientId } })
    : 0;
  if (isSupportMessage && priorMessageCount === 0 && !category) {
    return { ok: false, error: "Choose what this is about before sending." };
  }

  const created = await prisma.message.create({
    data: { senderId: session.user.id, recipientId, body: body.trim(), category: isSupportMessage ? category : null },
    select: { id: true },
  });
  if (isSupportMessage && extra?.department) {
    await setMessageMeta(created.id, { department: extra.department, subject: extra.subject?.trim().slice(0, 140) || null });
  }
  const { createNotification } = await import("@/lib/notify");
  await createNotification(recipientId, `New message from ${session.user.name}`, body.trim().slice(0, 140), "MESSAGE");

  if (isSupportMessage) {
    // Fire-and-forget: the in-app message (and the admin backend's own
    // Messages tab, which reads that same row) is already the real
    // record either way, so this never blocks or fails the send itself
    // if the notification errors. Reply-To is set to the sender's real
    // email — admin and public accounts use separate sessions, so
    // support replying by email directly is the practical path, not a
    // link back into the (session-gated) in-app thread; the admin
    // backend Messages tab is the other, in-app way to reply, and that
    // reply goes back out to this same sender's email too (see
    // actions/admin-messages.ts's sendAdminReply).
    const senderRecord = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true } });
    const categoryLabel = category ? SUPPORT_CATEGORIES.find((c) => c.key === category)?.label : undefined;
    sendEmail(
      SUPPORT_INBOX,
      `${categoryLabel ? `[${categoryLabel}] ` : ""}New message from ${session.user.name} (${session.user.role?.toLowerCase()})`,
      `<p><strong>${session.user.name}</strong> (${session.user.role?.toLowerCase()}) sent a support message${categoryLabel ? ` — category: <strong>${categoryLabel}</strong>` : ""}.</p><p style="white-space: pre-wrap;">${body.trim()}</p><p>Reply from Admin → Messages in the backend to answer both in their account and by email.</p>`,
      undefined,
      senderRecord?.email
    ).catch(() => {});
  }

  revalidatePath("/account/messages");
  revalidatePath(`/account/messages/${recipientId}`);
  return { ok: true };
}

/** Saves a draft for later — same shape as sendMessage, but marked
 * isDraft so it never reaches the recipient. */
export async function saveDraft(recipientId: string, body: string, extra?: { department?: DepartmentKey; subject?: string }): Promise<{ ok: boolean; error?: string; draftId?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "You need to be signed in." };
  if (!recipientId) return { ok: false, error: "Choose who this draft is for." };
  if (!body.trim()) return { ok: false, error: "Draft can't be empty." };

  const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
  if (!recipient) return { ok: false, error: "Recipient not found." };

  const draft = await prisma.message.create({
    data: { senderId: session.user.id, recipientId, body: body.trim(), isDraft: true },
  });
  if (extra?.department && DEPARTMENTS.some((d) => d.key === extra.department)) {
    await setMessageMeta(draft.id, { department: extra.department, subject: extra.subject?.trim().slice(0, 140) || null });
  }
  revalidatePath("/account/messages");
  return { ok: true, draftId: draft.id };
}

/** Updates an existing draft's text/recipient without sending it. */
export async function updateDraft(draftId: string, recipientId: string, body: string, extra?: { department?: DepartmentKey; subject?: string }): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: "You need to be signed in." };

  const draft = await prisma.message.findUnique({ where: { id: draftId } });
  if (!draft || draft.senderId !== session.user.id || !draft.isDraft) return { ok: false, error: "Draft not found." };
  if (!body.trim()) return { ok: false, error: "Draft can't be empty." };

  await prisma.message.update({ where: { id: draftId }, data: { recipientId, body: body.trim() } });
  if (extra?.department && DEPARTMENTS.some((d) => d.key === extra.department)) {
    await setMessageMeta(draftId, { department: extra.department, subject: extra.subject?.trim().slice(0, 140) || null });
  }
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

  // A draft written to one of our departments keeps its department and gets the matching support category when it is sent.
  const draftMeta = (await getMessageMeta([draftId])).get(draftId);
  const draftRecipient = await prisma.user.findUnique({ where: { id: draft.recipientId }, select: { role: true } });
  if (draftRecipient && BACKEND_ROLES.includes(draftRecipient.role) && !draftMeta?.department) {
    return { ok: false, error: "Open this draft with Edit and choose a department before sending it." };
  }
  const draftCategory = draftMeta?.department && DEPARTMENTS.some((d) => d.key === draftMeta.department) ? categoryForDepartment(draftMeta.department as DepartmentKey) : undefined;
  await prisma.message.update({ where: { id: draftId }, data: { isDraft: false, createdAt: new Date(), ...(draftCategory ? { category: draftCategory } : {}) } });
  const { createNotification } = await import("@/lib/notify");
  const sender = await prisma.user.findUnique({ where: { id: session.user.id } });
  await createNotification(draft.recipientId, `New message from ${sender?.name ?? "someone"}`, draft.body.trim().slice(0, 140), "MESSAGE");

  const recipient = await prisma.user.findUnique({ where: { id: draft.recipientId } });
  if (recipient && BACKEND_ROLES.includes(recipient.role)) {
    sendEmail(
      SUPPORT_INBOX,
      `New message from ${sender?.name ?? "someone"} (${sender?.role?.toLowerCase() ?? ""})`,
      `<p><strong>${sender?.name ?? "Someone"}</strong> sent a message via their account:</p><p style="white-space: pre-wrap;">${draft.body.trim()}</p>`,
      undefined,
      sender?.email
    ).catch(() => {});
  }

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


/* ---------- The redesigned inbox: everything the page needs in ONE trip, so switching conversations is instant ---------- */

export interface InboxMessage {
  id: string;
  body: string;
  createdAt: string;
  fromMe: boolean;
  automatic: boolean;
  department: string | null;
  subject: string | null;
}

export interface InboxConversation {
  key: string;
  counterpartId: string;
  name: string;
  /** True when the other side is our team (a backend account) rather than another reader or author. */
  isTeam: boolean;
  department: string | null;
  subject: string | null;
  automatic: boolean;
  lastAt: string;
  lastBody: string;
  unread: number;
  messages: InboxMessage[];
}

/** Conversations with their messages. Our team's messages are grouped by department; people are grouped by person. */
export async function loadInbox(): Promise<InboxConversation[]> {
  const session = await auth();
  if (!session?.user) return [];
  const me = session.user.id;
  try {
    const rows = await prisma.message.findMany({
      where: { isDraft: false, OR: [{ senderId: me }, { recipientId: me }] },
      include: { sender: { select: { name: true, role: true } }, recipient: { select: { name: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 400,
    });
    const meta = await getMessageMeta(rows.map((r: { id: string }) => r.id));
    const groups = new Map<string, InboxConversation>();
    const lastDept = new Map<string, string | null>();
    // Oldest first, so each conversation's messages read top to bottom and the last one seen is the latest.
    for (const m of [...rows].reverse() as {
      id: string; senderId: string; recipientId: string; body: string; createdAt: Date; readAt: Date | null; category: string | null;
      sender: { name: string; role: string }; recipient: { name: string; role: string };
    }[]) {
      const fromMe = m.senderId === me;
      const other = fromMe ? m.recipient : m.sender;
      const counterpartId = fromMe ? m.recipientId : m.senderId;
      const isTeam = BACKEND_ROLES.includes(other.role as never);
      const mm = meta.get(m.id);
      // An admin reply carries no department of its own: it joins the department of the conversation it answers.
      const department = isTeam ? (mm?.department ?? departmentForCategory(m.category) ?? lastDept.get(counterpartId) ?? null) : null;
      if (isTeam) lastDept.set(counterpartId, department);
      const key = `${counterpartId}|${department ?? ""}`;
      let g = groups.get(key);
      if (!g) {
        g = { key, counterpartId, name: isTeam ? (departmentOf(department)?.label ? `${departmentOf(department)!.label} Team` : "Support Team") : other.name, isTeam, department, subject: null, automatic: false, lastAt: "", lastBody: "", unread: 0, messages: [] };
        groups.set(key, g);
      }
      g.messages.push({ id: m.id, body: m.body, createdAt: m.createdAt.toISOString(), fromMe, automatic: !!mm?.automatic, department, subject: mm?.subject ?? null });
      g.lastAt = m.createdAt.toISOString();
      g.lastBody = m.body;
      g.automatic = !!mm?.automatic;
      if (mm?.subject) g.subject = mm.subject;
      if (!fromMe && !m.readAt) g.unread += 1;
    }
    return Array.from(groups.values()).sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  } catch {
    return [];
  }
}

/** Marks everything the other side sent you as read (called when a conversation is opened). */
export async function markConversationRead(counterpartId: string): Promise<void> {
  const session = await auth();
  if (!session?.user) return;
  try {
    await prisma.message.updateMany({ where: { senderId: counterpartId, recipientId: session.user.id, readAt: null, isDraft: false }, data: { readAt: new Date() } });
    revalidatePath("/account/messages");
  } catch {
    // not critical
  }
}
