"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authEither as auth } from "@/lib/auth-either";
import { canModerateContent, canRatifyModeration } from "@/lib/roles";
import { createNotification } from "@/actions/notifications";
import { submitUrlToIndexNow } from "@/lib/indexnow";
import { getPublicSiteUrl } from "@/lib/seo/site-url";
import { bookAuthorDisplayName } from "@/lib/book-author-name";
import { reportSystemError } from "@/lib/site-health/alert";
import { computeWalletForUserId } from "@/lib/compute-wallet-for-user";
import { createPayoutOnce } from "@/lib/payout-guard";
import { MIN_PAYOUT_AMOUNT } from "@/lib/payout-threshold";

/** True for the "Not authorized."/"Only Admins can..." errors
 * requireModerationRole()/requireAdminRole() throw deliberately — those
 * are an expected access-control outcome, not a real failure, so
 * payout-pipeline alerting (see below) skips them and only reports
 * genuinely unexpected errors. */
function isAuthorizationError(e: unknown): boolean {
  return e instanceof Error && (e.message === "Not authorized." || e.message.startsWith("Only Admins can"));
}

/**
 * Converted from the editorial workflow described in the brief (Draft →
 * Pending Review → Published, "Editors approve, Admins override") — this
 * is new functionality with no equivalent in the original frontend, which
 * had no admin/editor surface at all.
 *
 * Book/blog moderation is ADMIN + EDITOR only (canModerateContent()) —
 * ACCOUNTANT can see the backend but has no moderation power. Marking a
 * payout paid/rejected (the admin has already sent the money manually
 * outside this system) is ADMIN-only, deliberately narrower than "any
 * backend role" — ACCOUNTANT can view payout requests but not
 * approve/reject them.
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
    // Title is stored bare (just the book's title) so the Author
    // dashboard's Recent Activity card can prepend its own
    // plain-language line — see recentActivityLine in
    // lib/notification-types.ts. The fuller sentence stays in body for
    // the full Notifications list (app/account/notifications).
    await createNotification(book.author.user.id, book.title, `"${book.title}" is now published on the shelf.`, "BOOK_PUBLISHED");
    await notifyFollowersOfNewBook(book);
    submitUrlToIndexNow(`${getPublicSiteUrl()}/${book.slug}`).catch(() => {});
    revalidatePath("/admin/books");
    revalidatePath(`/admin/books/${bookId}/review`);
    revalidatePath("/account/authors");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

/**
 * The moment a book actually goes live (this is only ever called from
 * approveBook, right after the status flips to PUBLISHED), every reader
 * following the exact author name this book is published under — pen
 * name included, resolved the same way the book's own author card
 * resolves it (see lib/book-author-name.ts) — gets a real notification.
 * Per explicit instruction, this is keyed to the NAME, not the account:
 * following "J. Okoro" never notifies about a book the same account
 * published under a different name.
 */
async function notifyFollowersOfNewBook(book: {
  id: string;
  title: string;
  submissionMetadata: unknown;
  author: { penName: string | null; user: { name: string } };
}): Promise<void> {
  const authorName = bookAuthorDisplayName(book);
  const followers = await prisma.authorNameFollow.findMany({
    where: { authorName },
    include: { reader: { select: { userId: true } } },
  });
  await Promise.all(
    followers.map((f: { reader: { userId: string } }) =>
      createNotification(
        f.reader.userId,
        book.title,
        `${authorName} just published a new book: "${book.title}".`,
        "NEW_BOOK_BY_FOLLOWED_AUTHOR",
        book.id
      )
    )
  );
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
      `Revision requested: "${book.title}"`,
      comments?.trim()
        ? `"${book.title}" was sent back for revision: ${comments.trim()}`
        : `"${book.title}" was not approved this time — please revise and resubmit.`,
      "REVISION"
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

    if (canRatifyModeration(role)) {
      await prisma.book.update({
        where: { id: bookId },
        data: { status: action === "SUSPEND" ? "SUSPENDED" : "WITHDRAWN", pendingAction: null, pendingActionBy: null, pendingActionNote: null },
      });
      await createNotification(
        book.author.user.id,
        `${action === "SUSPEND" ? "Suspended" : "Withdrawn"}: "${book.title}"`,
        note?.trim() || `"${book.title}" has been ${action === "SUSPEND" ? "suspended" : "withdrawn"}.`,
        "REVISION"
      );
    } else {
      await prisma.book.update({
        where: { id: bookId },
        data: { pendingAction: action, pendingActionBy: session?.user?.name ?? "An editor", pendingActionNote: note?.trim() || null },
      });
      // Notify every Chief Editor and Admin directly — don't rely on
      // them happening to reopen this specific book and notice a banner.
      const ratifiers = await prisma.user.findMany({ where: { role: { in: ["CHIEF_EDITOR", "ADMIN"] } } });
      for (const u of ratifiers) {
        await createNotification(
          u.id,
          `${action === "SUSPEND" ? "Suspend" : "Withdraw"} proposed: "${book.title}"`,
          `${session?.user?.name ?? "An editor"} proposed to ${action === "SUSPEND" ? "suspend" : "withdraw"} this book${note?.trim() ? `: ${note.trim()}` : "."}`,
          "REVISION"
        );
      }
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
  if (!session?.user?.role || !canRatifyModeration(session.user.role)) return { ok: false, error: "Only an Admin or Chief Editor can ratify this." };

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
      `${book.pendingAction === "SUSPEND" ? "Suspended" : "Withdrawn"}: "${book.title}"`,
      book.pendingActionNote || `"${book.title}" has been ${book.pendingAction === "SUSPEND" ? "suspended" : "withdrawn"}.`,
      "REVISION"
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

/**
 * Marks a payout as paid — a direct, synchronous action, since the
 * admin has already sent the money manually outside this system
 * (there's no live payment gateway integration any more; see the
 * CSV/PDF exports on app/admin/payouts/page.tsx). The atomic `updateMany`
 * guard, keyed off status "REQUESTED", is what makes double-processing
 * the same payout impossible even if this is clicked twice in a row or
 * from two tabs — no PROCESSING intermediate state is needed since
 * nothing asynchronous happens here any more.
 */
/**
 * Accepts either a single real PayoutRequest id, or (see
 * lib/payout-ledger-dedupe.ts consolidateLedgerRows) the 2 real
 * ids behind one merged "both an author and an affiliate, same
 * queueDuePayouts run" display row — approving that row has to resolve
 * BOTH real payouts, or the second one is left stranded as a
 * still-REQUESTED row the next time the ledger loads, right back to
 * looking like an unresolved duplicate.
 */
/**
 * Idempotent against double payment: only a payout still in status
 * REQUESTED is ever flipped to PAID (an atomic, status-guarded
 * `updateMany`), so a payout that is already PAID, REJECTED or anything
 * else is never paid again — whether the id arrives alone, twice, from a
 * second tab, or as one of a merged row's component ids. The "Payout
 * sent" notification goes only to the payouts THIS call actually
 * claimed, never to an already-paid component that happens to share the
 * merged row. A REQUESTED payout that is the exact twin (same person,
 * same earnings type, same amount, same month) of one already PAID is
 * refused rather than paid a second time — see splitOutPaidTwins.
 */
export async function approvePayoutRequest(payoutId: string | string[]): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdminRole();
    const ids = [...new Set(Array.isArray(payoutId) ? payoutId : [payoutId])];

    const { payable, blocked } = await splitOutPaidTwins(ids);
    const resolvedAt = new Date();
    const claim = await prisma.payoutRequest.updateMany({
      where: { id: { in: payable }, status: { in: ["REQUESTED", "APPROVED"] } },
      data: { status: "PAID", resolvedAt },
    });
    if (claim.count === 0) {
      if (blocked.length > 0) {
        return { ok: false, error: "This looks like a duplicate of a payout that is already marked paid, so it was NOT paid a second time. Reject it instead." };
      }
      return { ok: false, error: "This payout has already been processed (or is no longer pending) — refresh to see its current status." };
    }

    const payouts = await prisma.payoutRequest.findMany({ where: { id: { in: payable }, status: "PAID", resolvedAt } });
    for (const payout of payouts) {
      await createNotification(payout.userId, "Payout sent", `Your $${Number(payout.amount).toFixed(2)} payout has been sent.`, "PAYOUT", payout.id);
    }
    revalidatePath("/admin/payouts");
    return { ok: true };
  } catch (e) {
    if (!isAuthorizationError(e)) await reportSystemError("PAYOUT", e, { action: "approvePayoutRequest", payoutId });
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

/**
 * Of these payout ids, which may still be paid: only ones currently
 * REQUESTED, minus any that is the exact twin (same user, same earnings
 * type, same amount, same calendar month of requestedAt) of a payout
 * that is already PAID — the signature of a duplicate row. Those are
 * returned as `blocked` so the caller can say why nothing was paid.
 */
async function splitOutPaidTwins(ids: string[]): Promise<{ payable: string[]; blocked: string[] }> {
  const candidates = await prisma.payoutRequest.findMany({ where: { id: { in: ids }, status: { in: ["REQUESTED", "APPROVED"] } } });
  const payable: string[] = [];
  const blocked: string[] = [];
  for (const c of candidates) {
    const start = new Date(c.requestedAt.getFullYear(), c.requestedAt.getMonth(), 1);
    const end = new Date(c.requestedAt.getFullYear(), c.requestedAt.getMonth() + 1, 1);
    const twin = await prisma.payoutRequest.findFirst({
      where: { id: { not: c.id }, userId: c.userId, earningsType: c.earningsType, status: "PAID", amount: c.amount, requestedAt: { gte: start, lt: end } },
      select: { id: true },
    });
    if (twin) blocked.push(c.id);
    else payable.push(c.id);
  }
  return { payable, blocked };
}

/** See approvePayoutRequest above re: accepting a merged row's 2 real ids. */
export async function rejectPayoutRequest(payoutId: string | string[]): Promise<{ ok: boolean; error?: string }> {
  try {
    await requireAdminRole();
    const ids = [...new Set(Array.isArray(payoutId) ? payoutId : [payoutId])];
    // Only a payout that is still open can be rejected. Rejecting one
    // that is already PAID would flip money that really went out back to
    // REJECTED, which rolls it into the balance and invites paying it a
    // second time — so PAID/REJECTED rows are never touched here.
    const resolvedAt = new Date();
    const open = ["REQUESTED", "APPROVED", "PROCESSING"] as ("REQUESTED" | "APPROVED" | "PROCESSING")[];
    const claim = await prisma.payoutRequest.updateMany({
      where: { id: { in: ids }, status: { in: open } },
      data: { status: "REJECTED", resolvedAt },
    });
    if (claim.count === 0) {
      return { ok: false, error: "This payout has already been processed (or is no longer pending) — refresh to see its current status." };
    }
    const payouts = await prisma.payoutRequest.findMany({ where: { id: { in: ids }, status: "REJECTED", resolvedAt } });
    for (const payout of payouts) {
      await createNotification(payout.userId, "Payout rejected", `Your $${Number(payout.amount).toFixed(2)} payout request was not approved.`, "PAYOUT", payout.id);
    }
    revalidatePath("/admin/payouts");
    return { ok: true };
  } catch (e) {
    if (!isAuthorizationError(e)) await reportSystemError("PAYOUT", e, { action: "rejectPayoutRequest", payoutId });
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}

/**
 * Pays a Category B ("Scheduled") synthetic row directly — one of
 * these has crossed the $30 minimum (lib/payout-threshold.ts) and is
 * confirmed/ready, but has no real PayoutRequest row behind it yet
 * (see actions/payout-ledger.ts getPendingUnqueuedRows — it's computed
 * fresh from real sale data on every load, not stored). Paying it
 * creates the real PayoutRequest(s) — already in status PAID, since
 * the admin is confirming money that's already been sent manually
 * outside this system, same as approvePayoutRequest() — using the FULL
 * accumulated rollover amount (computeWalletForUserId's `available`),
 * so a balance that rolled over across several cycles goes out as one
 * single combined payment per earnings type, never two.
 *
 * Amendment 5 (duplicate-row fix): the ledger now shows one merged row
 * per account (royalties/referral/commission as columns on the SAME
 * row — see getPendingUnqueuedRows), so the synthetic id is just
 * `pending-<userId>`, no longer `pending-author-<id>` /
 * `pending-affiliate-<id>`. But the real PayoutRequest model still
 * requires one row per earningsType (that's how actual transfers are
 * tracked), and the $30 minimum is still, correctly, checked
 * independently per type — so paying a merged row creates a real
 * PayoutRequest for EACH side (author wallet, affiliate wallet) that
 * individually clears $30 right now, and silently leaves any side that
 * doesn't yet clear it still accruing (it reappears next load as part
 * of this same person's row, once it does). Re-checks the $30 minimum
 * and recomputes both amounts fresh at the moment of paying — never
 * trusts a client-supplied figure.
 */
async function payScheduledBalance(syntheticId: string): Promise<{ ok: boolean; amount?: number; error?: string }> {
  const match = syntheticId.match(/^pending-(.+)$/);
  if (!match) return { ok: false, error: "Not a payable balance." };
  const userId = match[1];

  const recipient = await prisma.wiseRecipient.findFirst({ where: { userId }, orderBy: { isDefault: "desc" } });
  if (!recipient) return { ok: false, error: "This recipient has no payout destination on file." };

  const now = new Date();
  let paidTotal = 0;
  let alreadyPaidThisCycle = false;

  for (const { view, earningsType } of [
    { view: "author" as const, earningsType: "AUTHOR" as const },
    { view: "affiliate" as const, earningsType: "AFFILIATE" as const },
  ]) {
    const wallet = await computeWalletForUserId(userId, view);
    if (wallet.available < MIN_PAYOUT_AMOUNT) continue;

    // One payout per wallet per cycle, enforced inside a single
    // serializable transaction (lib/payout-guard.ts) — paying the same
    // balance twice (double click, two tabs, two admins) can create at
    // most one PAID row; the second call finds it and skips.
    const outcome = await createPayoutOnce({
      userId,
      recipientId: recipient.id,
      amount: wallet.available,
      earningsType,
      status: "PAID",
      resolvedAt: now,
      ignoreRejected: true,
      now,
    });
    if (!outcome.created) {
      alreadyPaidThisCycle = true;
      continue;
    }
    await createNotification(userId, "Payout sent", `Your $${wallet.available.toFixed(2)} payout has been sent.`, "PAYOUT", outcome.id);
    paidTotal += wallet.available;
  }

  if (paidTotal <= 0) {
    if (alreadyPaidThisCycle) return { ok: false, error: "This balance already has a payout for this cycle — it was NOT paid again. Refresh to see its current status." };
    return { ok: false, error: "This balance is still under the $30 minimum — it isn't actually due yet." };
  }
  return { ok: true, amount: paidTotal };
}

/**
 * The bulk counterpart to approvePayoutRequest() above — select
 * several/all due payouts on app/admin/payouts/PayoutsTable.tsx and
 * mark them all paid in one click, instead of one "Mark paid" click
 * per row. Handles two genuinely different row shapes in the same
 * call, since both are now bulk-payable (Amendment 5):
 *   - Real PayoutRequest rows in status REQUESTED — the exact same
 *     atomic, status-guarded `updateMany` as the single-row action. A
 *     row that isn't actually REQUESTED any more (already paid from
 *     another tab, rejected) is silently skipped rather than erroring
 *     out the whole batch.
 *   - Synthetic "Scheduled" (Category B) rows, which have no real
 *     PayoutRequest id yet — paid via payScheduledBalance() above,
 *     which creates that PayoutRequest on the fly, already PAID.
 * On Hold (Category A, still under $30) and Released/not-yet-released
 * rows are never selectable in the UI (isBulkPayable), so they never
 * reach this function at all.
 */
export async function bulkMarkPayoutsPaid(payoutIds: string[]): Promise<{ ok: boolean; updated?: number; error?: string }> {
  try {
    await requireAdminRole();
    if (!Array.isArray(payoutIds) || payoutIds.length === 0) {
      return { ok: false, error: "No payouts were selected." };
    }

    const uniqueIds = [...new Set(payoutIds)];
    const scheduledIds = uniqueIds.filter((id) => id.startsWith("pending-"));
    const realIds = uniqueIds.filter((id) => !scheduledIds.includes(id));

    let updated = 0;

    if (realIds.length > 0) {
      // Idempotent: only REQUESTED payouts are claimed (an already-PAID
      // component of a merged row is silently left alone), and an exact
      // twin of an already-PAID payout is never paid again.
      const { payable } = await splitOutPaidTwins(realIds);
      const resolvedAt = new Date();
      const claim = await prisma.payoutRequest.updateMany({
        where: { id: { in: payable }, status: { in: ["REQUESTED", "APPROVED"] } },
        data: { status: "PAID", resolvedAt },
      });
      if (claim.count > 0) {
        const paid = await prisma.payoutRequest.findMany({
          where: { id: { in: payable }, status: "PAID", resolvedAt },
        });
        for (const payout of paid) {
          await createNotification(payout.userId, "Payout sent", `Your $${Number(payout.amount).toFixed(2)} payout has been sent.`, "PAYOUT", payout.id);
        }
        updated += claim.count;
      }
    }

    for (const id of scheduledIds) {
      const result = await payScheduledBalance(id);
      if (result.ok) updated += 1;
    }

    if (updated > 0) revalidatePath("/admin/payouts");
    return { ok: true, updated };
  } catch (e) {
    if (!isAuthorizationError(e)) await reportSystemError("PAYOUT", e, { action: "bulkMarkPayoutsPaid", payoutIds });
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong." };
  }
}
