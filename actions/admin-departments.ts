"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authAdmin } from "@/lib/auth-admin";
import { sendEmail } from "@/lib/email";
import { BACKEND_ROLES, type Role } from "@/lib/roles";
import { DEPARTMENTS, departmentForCategory, type DepartmentKey } from "@/lib/message-departments";
import { departmentsOfStaff, isDepartmentKey, listStaffWithDepartments } from "@/lib/departments-server";
import { getMessageMeta, setMessageMeta, setWorkflowStatus, type WorkflowStatus } from "@/lib/message-meta";
import { Prisma } from "@prisma/client";

/**
 * The back end's department inboxes. ONE inbox per department; a person only ever sees the departments they belong to
 * (Admin sees all of them plus an overall view). Every function here checks that on the SERVER, so a hidden button is never
 * the only protection. Messages are never deleted: "Resolved" is only a status.
 */

async function requireStaff() {
  const session = await authAdmin();
  const role = session?.user?.role as Role | undefined;
  if (!session?.user || !role || !BACKEND_ROLES.includes(role) || role === "INVESTOR") return null;
  const departments = await departmentsOfStaff(session.user.id, role);
  return { id: session.user.id, name: session.user.name ?? "Our Team", role, departments, isAdmin: role === "ADMIN" };
}

export interface DepartmentThread {
  key: string;
  counterpartId: string;
  counterpartName: string;
  counterpartRole: string;
  department: DepartmentKey;
  subject: string | null;
  lastAt: string;
  lastBody: string;
  automatic: boolean;
  status: WorkflowStatus;
  unread: number;
  bookId: string | null;
  bookTitle: string | null;
  bookSn: string | null;
}

export interface DepartmentMessage {
  id: string;
  body: string;
  createdAt: string;
  fromStaff: boolean;
  senderName: string;
  automatic: boolean;
  bookId: string | null;
  bookTitle: string | null;
  bookSn: string | null;
}

interface Row {
  id: string; senderId: string; recipientId: string; body: string; createdAt: Date; readAt: Date | null; category: string | null;
  sender: { name: string; role: string }; recipient: { name: string; role: string };
}

/** Every real message between a reader/author and our team, grouped into department threads. Newest first. */
async function loadThreads(): Promise<{ threads: DepartmentThread[]; messageIds: Map<string, string[]> }> {
  const rows = (await prisma.message.findMany({
    where: { isDraft: false, OR: [{ recipient: { role: { in: BACKEND_ROLES } } }, { sender: { role: { in: BACKEND_ROLES } } }] },
    include: { sender: { select: { name: true, role: true } }, recipient: { select: { name: true, role: true } } },
    orderBy: { createdAt: "asc" },
    take: 3000,
  })) as Row[];
  const meta = await getMessageMeta(rows.map((r) => r.id));
  const lastDept = new Map<string, DepartmentKey>();
  const threads = new Map<string, DepartmentThread>();
  const messageIds = new Map<string, string[]>();
  for (const m of rows) {
    const fromStaff = BACKEND_ROLES.includes(m.sender.role as Role);
    const toStaff = BACKEND_ROLES.includes(m.recipient.role as Role);
    if (fromStaff === toStaff) continue; // staff to staff, or neither: not a support thread
    const counterpartId = fromStaff ? m.recipientId : m.senderId;
    const counterpart = fromStaff ? m.recipient : m.sender;
    const mm = meta.get(m.id);
    const raw = mm?.department && isDepartmentKey(mm.department) ? mm.department : departmentForCategory(m.category) ?? lastDept.get(counterpartId) ?? "OPERATIONS";
    const department = raw as DepartmentKey;
    lastDept.set(counterpartId, department);
    const key = `${counterpartId}|${department}`;
    let t = threads.get(key);
    if (!t) {
      t = { key, counterpartId, counterpartName: counterpart.name, counterpartRole: counterpart.role, department, subject: null, lastAt: "", lastBody: "", automatic: false, status: "NEW", unread: 0, bookId: null, bookTitle: null, bookSn: null };
      threads.set(key, t);
      messageIds.set(key, []);
    }
    messageIds.get(key)!.push(m.id);
    t.lastAt = m.createdAt.toISOString();
    t.lastBody = m.body;
    t.automatic = !!mm?.automatic;
    if (mm?.subject) t.subject = mm.subject;
    if (mm?.bookTitle) { t.bookId = mm.bookId; t.bookTitle = mm.bookTitle; t.bookSn = mm.bookSn; }
    // The thread's status is the newest status on the user's side of it (a staff reply never reopens or closes by itself).
    if (!fromStaff || t.status === "NEW") t.status = mm?.workflowStatus ?? t.status;
    if (!fromStaff && !m.readAt) t.unread += 1;
  }
  return { threads: [...threads.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1)), messageIds };
}

export interface InboxSummary {
  allowed: DepartmentKey[];
  isAdmin: boolean;
  /** New threads plus threads with unread messages, per department: the number shown on each inbox. */
  counts: Record<string, number>;
  threads: DepartmentThread[];
  staff: { id: string; name: string; email: string; role: string; departments: DepartmentKey[] }[];
}

/** The inbox for one department, or "ALL" (Admin only) for the overall view. */
export async function loadDepartmentInbox(which: DepartmentKey | "ALL"): Promise<InboxSummary | null> {
  const staff = await requireStaff();
  if (!staff) return null;
  const { threads } = await loadThreads();
  const visible = threads.filter((t) => staff.departments.includes(t.department));
  const counts: Record<string, number> = { ALL: 0 };
  for (const d of DEPARTMENTS) counts[d.key] = 0;
  for (const t of visible) if (t.status === "NEW" || t.unread > 0) { counts[t.department] += 1; counts.ALL += 1; }
  const wanted = which === "ALL" ? (staff.isAdmin ? visible : []) : staff.departments.includes(which) ? visible.filter((t) => t.department === which) : [];
  return { allowed: staff.departments, isAdmin: staff.isAdmin, counts, threads: wanted, staff: staff.isAdmin ? await listStaffWithDepartments() : [] };
}

/** One thread with its messages. Refused unless the person belongs to that thread's department. */
export async function loadDepartmentThread(counterpartId: string, department: string): Promise<{ thread: DepartmentThread; messages: DepartmentMessage[] } | null> {
  const staff = await requireStaff();
  if (!staff || !isDepartmentKey(department) || !staff.departments.includes(department)) return null;
  const { threads, messageIds } = await loadThreads();
  const thread = threads.find((t) => t.counterpartId === counterpartId && t.department === department);
  if (!thread) return null;
  const ids = messageIds.get(thread.key) ?? [];
  const rows = (await prisma.message.findMany({ where: { id: { in: ids } }, include: { sender: { select: { name: true, role: true } } }, orderBy: { createdAt: "asc" } })) as unknown as { id: string; body: string; createdAt: Date; sender: { name: string; role: string } }[];
  const meta = await getMessageMeta(ids);
  // Opening a thread marks what the user sent as read.
  await prisma.message.updateMany({ where: { id: { in: ids }, senderId: counterpartId, readAt: null }, data: { readAt: new Date() } }).catch(() => {});
  return {
    thread,
    messages: rows.map((m) => ({
      id: m.id, body: m.body, createdAt: m.createdAt.toISOString(), fromStaff: BACKEND_ROLES.includes(m.sender.role as Role), senderName: m.sender.name,
      automatic: !!meta.get(m.id)?.automatic, bookId: meta.get(m.id)?.bookId ?? null, bookTitle: meta.get(m.id)?.bookTitle ?? null, bookSn: meta.get(m.id)?.bookSn ?? null,
    })),
  };
}

export async function setThreadStatus(counterpartId: string, department: string, status: WorkflowStatus): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff();
  if (!staff || !isDepartmentKey(department) || !staff.departments.includes(department)) return { ok: false, error: "Not allowed." };
  if (!["NEW", "IN_PROGRESS", "RESOLVED"].includes(status)) return { ok: false, error: "Unknown status." };
  const { messageIds } = await loadThreads();
  const ids = messageIds.get(`${counterpartId}|${department}`) ?? [];
  if (ids.length === 0) return { ok: false, error: "Conversation not found." };
  const ok = await setWorkflowStatus(ids, status);
  if (!ok) return { ok: false, error: "Statuses need the latest database update (the migration) first." };
  revalidatePath("/admin/messages");
  return { ok: true };
}

/** A staff reply: saved as a real message in the user's Messages (in this department's conversation) and emailed to them. */
export async function replyInDepartment(counterpartId: string, department: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff();
  if (!staff || !isDepartmentKey(department) || !staff.departments.includes(department)) return { ok: false, error: "Not allowed." };
  if (!body.trim()) return { ok: false, error: "Message can't be empty." };
  const counterpart = await prisma.user.findUnique({ where: { id: counterpartId } });
  if (!counterpart || BACKEND_ROLES.includes(counterpart.role as Role)) return { ok: false, error: "Account not found." };
  const label = DEPARTMENTS.find((d) => d.key === department)!.label;
  const created = await prisma.message.create({ data: { senderId: staff.id, recipientId: counterpartId, body: body.trim() }, select: { id: true } });
  await setMessageMeta(created.id, { department });
  const { createNotification } = await import("@/lib/notify");
  await createNotification(counterpartId, `New message from ${label}`, body.trim().slice(0, 140), "MESSAGE");
  await sendEmail(
    counterpart.email, `New reply from ${label} at The Good Child Bookstore`,
    `<p>Hi ${counterpart.name.replace(/[<>&"]/g, "")},</p><p style="white-space: pre-wrap;">${body.trim().replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string)}</p><p>You can reply from your account's Messages page.</p>`,
    undefined, process.env.SUPPORT_INBOX_EMAIL || "support@thegoodchildbookstore.com"
  ).catch(() => {});
  // A first reply moves a New thread to In Progress. Resolving stays a deliberate choice.
  const after = await loadThreads();
  const ids = after.messageIds.get(`${counterpartId}|${department}`) ?? [];
  const t = after.threads.find((x) => x.counterpartId === counterpartId && x.department === department);
  if (t?.status === "NEW") await setWorkflowStatus(ids, "IN_PROGRESS");
  revalidatePath("/admin/messages");
  revalidatePath("/account/messages");
  return { ok: true };
}

/** Admin only: hand a department to a staff member (or take it away). Changes nothing about their role. */
export async function setStaffDepartment(userId: string, department: string, on: boolean): Promise<{ ok: boolean; error?: string }> {
  const staff = await requireStaff();
  if (!staff?.isAdmin) return { ok: false, error: "Only Admins can hand out departments." };
  if (!isDepartmentKey(department)) return { ok: false, error: "Unknown department." };
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target || !BACKEND_ROLES.includes(target.role as Role)) return { ok: false, error: "That person is not a staff member." };
  try {
    if (on) await prisma.$executeRaw(Prisma.sql`INSERT INTO "StaffDepartment" ("userId", "department") VALUES (${userId}, ${department}) ON CONFLICT DO NOTHING`);
    else await prisma.$executeRaw(Prisma.sql`DELETE FROM "StaffDepartment" WHERE "userId" = ${userId} AND "department" = ${department}`);
  } catch {
    return { ok: false, error: "Departments need the latest database update (the migration) first." };
  }
  revalidatePath("/admin/messages");
  return { ok: true };
}
