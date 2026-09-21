"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

async function requireAdmin(): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Only Admins can manage test data." };
  return { ok: true };
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
  const session = await auth();

  await prisma.$transaction([
    prisma.user.updateMany({ where: { id: { not: session!.user.id } }, data: { isTestData: true } }),
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

  try {
    const orders = await prisma.order.deleteMany({ where: { isTestData: true } });
    const books = await prisma.book.deleteMany({ where: { isTestData: true } });
    const accounts = await prisma.user.deleteMany({ where: { isTestData: true } });

    revalidatePath("/admin");
    revalidatePath("/admin/data-management");
    revalidatePath("/admin/books");
    revalidatePath("/admin/users");

    return { ok: true, deleted: { accounts: accounts.count, books: books.count, orders: orders.count } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't delete test data." };
  }
}
