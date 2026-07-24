"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canModerateContent } from "@/lib/roles";
import { createNotification } from "@/actions/notifications";

/**
 * Converted from the editorial workflow described in the brief (Draft →
 * Pending Review → Published, "Editors approve, Admins override") — this
 * is new functionality with no equivalent in the original frontend, which
 * had no admin/editor surface at all.
 *
 * Book/blog moderation is ADMIN + EDITOR only (canModerateContent()) —
 * ACCOUNTANT can see the backend but has no moderation power. Payout
 * *execution* (actually moving money via Wise) is ADMIN-only, deliberately
 * narrower than "any backend role" — ACCOUNTANT can view payout requests
 * but not approve/reject them.
 */

async function requireModerationRole() {
  const session = await auth();
  const role = session?.user?.role;
  if (!role || !canModerateContent(role)) {
    throw new Error("Not authorized.");
  }
  return role;
}

async function requireAdminRole() {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== "ADMIN") {
    throw new Error("Only Admins can approve or reject payouts.");
  }
  return role;
}

export async function approveBook(bookId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireModerationRole();
    const book = await prisma.book.update({
      where: { id: bookId },
      data: { status: "PUBLISHED" },
      include: { author: { include: { user: true } } },
    });
    await createNotification(book.author.user.id, "Book approved", `"${book.title}" is now published on the shelf.`);
    revalidatePath("/admin/books");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function rejectBook(bookId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireModerationRole();
    const book = await prisma.book.update({
      where: { id: bookId },
      data: { status: "REJECTED" },
      include: { author: { include: { user: true } } },
    });
    await createNotification(book.author.user.id, "Book needs changes", `"${book.title}" was not approved this time — please revise and resubmit.`);
    revalidatePath("/admin/books");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function approvePayoutRequest(payoutId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdminRole();
    const payout = await prisma.payoutRequest.findUnique({ where: { id: payoutId }, include: { recipient: true } });
    if (!payout) return { ok: false, error: "Payout request not found." };

    const { executeWisePayout } = await import("@/lib/payments/wise");
    const result = await executeWisePayout(
      Number(payout.amount),
      payout.recipient.currency,
      payout.recipient.wiseRecipientId ?? payout.recipient.id,
      payout.id
    );

    if (result.ok) {
      await prisma.payoutRequest.update({
        where: { id: payoutId },
        data: { status: "PAID", resolvedAt: new Date(), wiseTransferId: result.transferId },
      });
      await createNotification(payout.userId, "Payout sent", `Your $${Number(payout.amount).toFixed(2)} payout has been sent via Wise.`);
    } else {
      await prisma.payoutRequest.update({
        where: { id: payoutId },
        data: { failureReason: result.error },
      });
      return { ok: false, error: result.error ?? "Wise payout failed — Wise may not be configured in this environment." };
    }
    revalidatePath("/admin/payouts");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function rejectPayoutRequest(payoutId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdminRole();
    const payout = await prisma.payoutRequest.update({
      where: { id: payoutId },
      data: { status: "REJECTED", resolvedAt: new Date() },
    });
    await createNotification(payout.userId, "Payout rejected", `Your $${Number(payout.amount).toFixed(2)} payout request was not approved.`);
    revalidatePath("/admin/payouts");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
