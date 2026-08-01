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
      data: { status: "PUBLISHED", revisionNotes: null },
      include: { author: { include: { user: true } } },
    });
    await createNotification(book.author.user.id, "Book approved", `"${book.title}" is now published on the shelf.`);
    revalidatePath("/admin/books");
    revalidatePath(`/admin/books/${bookId}/review`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function rejectBook(bookId: string, comments?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireModerationRole();
    const book = await prisma.book.update({
      where: { id: bookId },
      data: { status: "REJECTED", revisionNotes: comments?.trim() || null },
      include: { author: { include: { user: true } } },
    });
    await createNotification(
      book.author.user.id,
      "Book needs changes",
      comments?.trim()
        ? `"${book.title}" was sent back for revision: ${comments.trim()}`
        : `"${book.title}" was not approved this time — please revise and resubmit.`
    );
    revalidatePath("/admin/books");
    revalidatePath(`/admin/books/${bookId}/review`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

/**
 * Suspend/Withdraw — a Book, not a User, gets moderated here. Both
 * follow the same rule: an Admin acting directly applies the status
 * change immediately; an Editor can only *propose* it, which just
 * records the request (the book's actual status doesn't change yet)
 * until an Admin ratifies or declines it. This is deliberately
 * different from approve/reject, which either role can finalize on
 * their own — per explicit instruction, only Suspend and Withdraw
 * require Admin sign-off.
 */
async function proposeOrApplyModeration(bookId: string, action: "SUSPEND" | "WITHDRAW", note: string | undefined): Promise<{ ok: boolean; error?: string }> {
  try {
    const role = await requireModerationRole();
    const session = await auth();
    const book = await prisma.book.findUnique({ where: { id: bookId }, include: { author: { include: { user: true } } } });
    if (!book) return { ok: false, error: "Book not found." };

    if (role === "ADMIN") {
      await prisma.book.update({
        where: { id: bookId },
        data: { status: action === "SUSPEND" ? "SUSPENDED" : "WITHDRAWN", pendingAction: null, pendingActionBy: null, pendingActionNote: null },
      });
      await createNotification(
        book.author.user.id,
        action === "SUSPEND" ? "Book suspended" : "Book withdrawn",
        note?.trim() || `"${book.title}" has been ${action === "SUSPEND" ? "suspended" : "withdrawn"}.`
      );
    } else {
      await prisma.book.update({
        where: { id: bookId },
        data: { pendingAction: action, pendingActionBy: session?.user?.name ?? "An editor", pendingActionNote: note?.trim() || null },
      });
    }
    revalidatePath("/admin/books");
    revalidatePath(`/admin/books/${bookId}/review`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

export async function proposeOrApplySuspend(bookId: string, note?: string) {
  return proposeOrApplyModeration(bookId, "SUSPEND", note);
}
export async function proposeOrApplyWithdraw(bookId: string, note?: string) {
  return proposeOrApplyModeration(bookId, "WITHDRAW", note);
}

/** Admin-only: confirms or declines an Editor's proposed Suspend/Withdraw. */
export async function ratifyPendingModeration(bookId: string, approve: boolean): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Only Admins can ratify this." };

  const book = await prisma.book.findUnique({ where: { id: bookId }, include: { author: { include: { user: true } } } });
  if (!book) return { ok: false, error: "Book not found." };
  if (!book.pendingAction) return { ok: false, error: "There's no pending action to ratify." };

  if (approve) {
    await prisma.book.update({
      where: { id: bookId },
      data: { status: book.pendingAction === "SUSPEND" ? "SUSPENDED" : "WITHDRAWN", pendingAction: null, pendingActionBy: null, pendingActionNote: null },
    });
    await createNotification(
      book.author.user.id,
      book.pendingAction === "SUSPEND" ? "Book suspended" : "Book withdrawn",
      book.pendingActionNote || `"${book.title}" has been ${book.pendingAction === "SUSPEND" ? "suspended" : "withdrawn"}.`
    );
  } else {
    await prisma.book.update({ where: { id: bookId }, data: { pendingAction: null, pendingActionBy: null, pendingActionNote: null } });
  }
  revalidatePath("/admin/books");
  revalidatePath(`/admin/books/${bookId}/review`);
  return { ok: true };
}

/** Saves the editor/admin's checklist progress for a specific book —
 * does not change the book's status on its own. */
export async function saveReviewChecklist(bookId: string, checklist: Record<string, boolean>): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireModerationRole();
    const value = JSON.parse(JSON.stringify(checklist));
    await prisma.book.update({ where: { id: bookId }, data: { reviewChecklist: value } });
    revalidatePath(`/admin/books/${bookId}/review`);
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
