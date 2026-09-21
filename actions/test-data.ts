"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authEither as auth } from "@/lib/auth-either";

async function requireAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Only Admins can manage test data." };
  return { ok: true };
}

const SITE_MODE_KEY = "site_data_mode";

/** The site-wide data mode: when "test", every new account, book
 * submission, and order is automatically flagged as test data the
 * moment it's created — no manual marking needed afterward. Read from
 * anywhere in the app (signup, book submission, order creation) via
 * getSiteDataMode(); changed only from Data Management, and only by
 * an Admin. */
export async function getSiteDataMode(): Promise<"live" | "test"> {
  try {
    const setting = await prisma.setting.findUnique({ where: { key: SITE_MODE_KEY } });
    const value = setting?.value as { mode?: string } | null;
    return value?.mode === "test" ? "test" : "live";
  } catch {
    return "live";
  }
}

export async function setSiteDataMode(mode: "live" | "test"): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  await prisma.setting.upsert({
    where: { key: SITE_MODE_KEY },
    update: { value: { mode } },
    create: { key: SITE_MODE_KEY, value: { mode } },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/data-management");
  return { ok: true };
}

export interface AffectedAccount {
  id: string;
  email: string;
  name: string;
  role: string;
  isCurrentUser: boolean;
}

/** The real, specific list of accounts that "mark as test" would
 * affect — shown to the admin before they confirm, so they can
 * actually see which emails are about to be flagged rather than
 * trusting a bare count. This is what a count alone can't catch: if
 * you're signed in as the wrong account, you'd see your real email in
 * this list and know to stop. */
export async function listAccountsAffectedByMarkAsTest(): Promise<AffectedAccount[] | { error: string }> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };
  const session = await auth();

  const users = await prisma.user.findMany({
    where: { isTestData: false },
    select: { id: true, email: true, name: true, role: true },
    orderBy: { role: "asc" },
  });

  return users.map((u: { id: string; email: string; name: string; role: string }) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    isCurrentUser: u.id === session!.user.id,
  }));
}

export async function listAccountsAffectedByDelete(): Promise<AffectedAccount[] | { error: string }> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };
  const session = await auth();

  const users = await prisma.user.findMany({
    where: { isTestData: true },
    select: { id: true, email: true, name: true, role: true },
    orderBy: { role: "asc" },
  });

  return users.map((u: { id: string; email: string; name: string; role: string }) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    isCurrentUser: u.id === session!.user.id,
  }));
}

export interface AuditLogEntry {
  id: string;
  actorName: string;
  actorEmail: string;
  action: string;
  metadata: unknown;
  createdAt: Date;
}

export async function getTestDataAuditLog(): Promise<AuditLogEntry[] | { error: string }> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const entries = await prisma.auditLog.findMany({
    where: { action: "DELETE_ALL_TEST_DATA" },
    include: { actor: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return entries.map((e: { id: string; actor: { name: string; email: string }; action: string; metadata: unknown; createdAt: Date }) => ({
    id: e.id,
    actorName: e.actor.name,
    actorEmail: e.actor.email,
    action: e.action,
    metadata: e.metadata,
    createdAt: e.createdAt,
  }));
}

export interface TestDataSummary {
  testAccounts: number;
  testBooks: number;
  testOrders: number;
  liveAccounts: number;
  liveBooks: number;
  liveOrders: number;
}

export async function getTestDataSummary(): Promise<TestDataSummary | { error: string }> {
  const gate = await requireAdmin();
  if (!gate.ok) return { error: gate.error };

  const [testAccounts, testBooks, testOrders, liveAccounts, liveBooks, liveOrders] = await Promise.all([
    prisma.user.count({ where: { isTestData: true } }),
    prisma.book.count({ where: { isTestData: true } }),
    prisma.order.count({ where: { isTestData: true } }),
    prisma.user.count({ where: { isTestData: false } }),
    prisma.book.count({ where: { isTestData: false } }),
    prisma.order.count({ where: { isTestData: false } }),
  ]);

  return { testAccounts, testBooks, testOrders, liveAccounts, liveBooks, liveOrders };
}

/**
 * Applies the isTestData flag only to the specific records identified
 * by the evidence-based scan (see actions/test-data-detection.ts) —
 * not a blanket "mark everything" anymore. Nothing is deleted here;
 * this is still a reversible flag-set, reviewed by the admin against
 * the actual preview report before this is ever called.
 */
export async function applyDetectedTestDataFlags(userIds: string[], bookIds: string[], orderIds: string[]): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  await prisma.$transaction([
    prisma.user.updateMany({ where: { id: { in: userIds }, role: { in: ["READER", "AUTHOR"] } }, data: { isTestData: true } }),
    prisma.book.updateMany({ where: { id: { in: bookIds } }, data: { isTestData: true } }),
    prisma.order.updateMany({ where: { id: { in: orderIds } }, data: { isTestData: true } }),
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/data-management");
  return { ok: true };
}

/**
 * One-time setup step: marks every account, book, and order that
 * exists right now as test data. This is a real, meaningful line in
 * time — anything created from this moment forward (new signups, new
 * submissions, new orders) is untouched and defaults to live/real, per
 * the schema default. This is a flag-set, not a delete — completely
 * reversible, and nothing is removed until a separate, explicit delete
 * step. The calling admin's own account is left alone, since they are
 * presumably a real account, not test data.
 */
export async function markAllExistingDataAsTest(): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };

  await prisma.$transaction([
    // Backend staff accounts (Admin, Editor, Accountant) are never
    // touched by this tool, full stop — not just "whichever session
    // happens to be active right now". Only Reader/Author accounts can
    // ever be marked as test data.
    prisma.user.updateMany({ where: { role: { in: ["READER", "AUTHOR"] } }, data: { isTestData: true } }),
    prisma.book.updateMany({ data: { isTestData: true } }),
    prisma.order.updateMany({ data: { isTestData: true } }),
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/data-management");
  return { ok: true };
}

/**
 * Permanently deletes every record flagged as test data — accounts,
 * books, and orders/financial history. Only ever touches rows where
 * isTestData is true; nothing marked as live is ever at risk. Ordered
 * to respect foreign key dependencies: orders (and their sale lines)
 * first, then books, then accounts (which cascades to each account's
 * author/reader/affiliate profile and everything under it).
 */
export async function deleteAllTestData(): Promise<{ ok: boolean; error?: string; deleted?: { accounts: number; books: number; orders: number } }> {
  const gate = await requireAdmin();
  if (!gate.ok) return { ok: false, error: gate.error };
  const session = await auth();

  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // No sales-count or transaction-existence check here, by
      // design: everything in this scope is already flagged as test
      // data (via evidence-based detection or explicit marking,
      // reviewed by the admin beforehand) — dependent test records
      // (sale lines, payment logs, affiliate links, etc.) are removed
      // together with their parent order/book/account, not treated as
      // a reason to block. That blocking behavior still exists, and
      // is still correct, for the separate single-book admin delete
      // action, which has no such prior evidence review.
      const orders = await tx.order.deleteMany({ where: { isTestData: true } });
      const books = await tx.book.deleteMany({ where: { isTestData: true } });
      // Never delete backend staff accounts through this tool, even if
      // isTestData were somehow set true on one — only Reader/Author
      // test accounts are ever removed here.
      const accounts = await tx.user.deleteMany({ where: { isTestData: true, role: { in: ["READER", "AUTHOR"] } } });

      await tx.auditLog.create({
        data: {
          actorId: session!.user.id,
          action: "DELETE_ALL_TEST_DATA",
          metadata: { accounts: accounts.count, books: books.count, orders: orders.count, deletedAt: new Date().toISOString() },
        },
      });

      return { accounts: accounts.count, books: books.count, orders: orders.count };
    });

    revalidatePath("/admin");
    revalidatePath("/admin/data-management");
    revalidatePath("/admin/books");
    revalidatePath("/admin/users");

    return { ok: true, deleted: result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't delete test data." };
  }
}
