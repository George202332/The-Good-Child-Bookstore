import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * One general rule for the whole site: when an item that can have a
 * notification is deleted, every notification tied specifically to that
 * item is deleted with it, so nothing is left behind in the Recent
 * Activity feed or the Notifications page.
 *
 * How it works
 * ------------
 * Every notification that is generated from a deletable item stores that
 * item's id in `Notification.relatedRecordId` (a book id, a review id, a
 * blog id, an order id, a sale line id, a payout id). Deleting the item
 * therefore only needs to delete the notifications carrying its id.
 *
 * Each "prepare" function below is called BEFORE the item is deleted (so
 * it can still look up the item's children, e.g. a book's reviews) and
 * returns a function to call AFTER the delete succeeded:
 *
 *   const cleanup = await prepareBookNotificationCleanup(bookId);
 *   await prisma.book.delete({ where: { id: bookId } });
 *   await cleanup();
 *
 * This order means a failed delete never loses notifications, and a
 * failed cleanup never blocks or undoes the delete (cleanup is
 * best-effort and never throws).
 *
 * Older notifications
 * -------------------
 * Notifications created before this rule existed have no
 * `relatedRecordId`, so they cannot be matched by id. For books and
 * blogs only, the cleanup also removes those older notifications when
 * they were sent to the item's owner, carry the item's exact title in
 * the standard wording, and no other item by the same owner shares that
 * title (so a same-titled sibling's notification is never removed by
 * mistake).
 */

type Db = Prisma.TransactionClient;
type Cleanup = () => Promise<void>;

const NOOP: Cleanup = async () => {};

function clean(ids: Array<string | null | undefined>): string[] {
  return Array.from(new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0)));
}

async function deleteByRecordIds(ids: string[], db: Db): Promise<void> {
  if (ids.length === 0) return;
  await db.notification.deleteMany({ where: { relatedRecordId: { in: ids } } });
}

/** Deletes every notification tied to any of these record ids (sale
 * line, payout, order, review, book, blog). Safe to call with an empty
 * list. Never throws. */
export async function deleteNotificationsForRecords(ids: Array<string | null | undefined>, db: Db = prisma): Promise<void> {
  try {
    await deleteByRecordIds(clean(ids), db);
  } catch {
    // Best-effort: a failed notification cleanup must never undo or
    // block the delete that triggered it.
  }
}

/** Book: its own notifications (published, revision requested,
 * suspended/withdrawn, "new book by a followed author"), plus the
 * "you've got a review" notifications for each of its reviews. */
export async function prepareBookNotificationCleanup(bookId: string, db: Db = prisma): Promise<Cleanup> {
  try {
    const book = await db.book.findUnique({
      where: { id: bookId },
      select: { title: true, author: { select: { user: { select: { id: true } } } } },
    });
    const reviews = await db.review.findMany({ where: { bookId }, select: { id: true } });
    const ids = clean([bookId, ...reviews.map((r: { id: string }) => r.id)]);

    const ownerId = book?.author?.user?.id ?? null;
    const title = book?.title ?? null;
    let legacyTitles: string[] = [];
    if (ownerId && title) {
      const sameTitle = await db.book.count({ where: { title, id: { not: bookId }, author: { user: { id: ownerId } } } });
      if (sameTitle === 0) {
        legacyTitles = [title, `Revision requested: "${title}"`, `Suspended: "${title}"`, `Withdrawn: "${title}"`];
      }
    }

    return async () => {
      try {
        await deleteByRecordIds(ids, db);
        if (ownerId && legacyTitles.length > 0) {
          await db.notification.deleteMany({
            where: {
              userId: ownerId,
              relatedRecordId: null,
              type: { in: ["BOOK_PUBLISHED", "REVISION", "REVIEW"] },
              title: { in: legacyTitles },
            },
          });
        }
      } catch {
        // Best-effort.
      }
    };
  } catch {
    return NOOP;
  }
}

/** A single review: the author's "you've got a review" notification. */
export async function prepareReviewNotificationCleanup(reviewId: string, db: Db = prisma): Promise<Cleanup> {
  const ids = clean([reviewId]);
  return async () => deleteNotificationsForRecords(ids, db);
}

/** Blog post: published, revision requested, suspended and withdrawn
 * notifications. */
export async function prepareBlogNotificationCleanup(blogId: string, db: Db = prisma): Promise<Cleanup> {
  try {
    const blog = await db.blog.findUnique({ where: { id: blogId }, select: { title: true, authorId: true } });
    const ids = clean([blogId]);

    let legacyTitles: string[] = [];
    if (blog) {
      const sameTitle = await db.blog.count({ where: { title: blog.title, id: { not: blogId }, authorId: blog.authorId } });
      if (sameTitle === 0) {
        legacyTitles = [
          `Published: "${blog.title}"`,
          `Revision requested: "${blog.title}"`,
          `Suspended: "${blog.title}"`,
          `Withdrawn: "${blog.title}"`,
        ];
      }
    }

    return async () => {
      try {
        await deleteByRecordIds(ids, db);
        if (blog && legacyTitles.length > 0) {
          await db.notification.deleteMany({
            where: { userId: blog.authorId, relatedRecordId: null, type: { in: ["BLOG_PUBLISHED", "BLOG_REVISION"] }, title: { in: legacyTitles } },
          });
        }
      } catch {
        // Best-effort.
      }
    };
  } catch {
    return NOOP;
  }
}

/** Everything a user's account owns that other people may have been
 * notified about: their books (and those books' reviews), the reviews
 * they wrote, their blog posts, and their orders. Their own
 * notifications are removed by the database (cascade) with the account. */
export async function prepareUserContentNotificationCleanup(userId: string, db: Db = prisma): Promise<Cleanup> {
  try {
    const books = await db.book.findMany({ where: { author: { user: { id: userId } } }, select: { id: true } });
    const bookIds = books.map((b: { id: string }) => b.id);
    const reviewsOnBooks = bookIds.length > 0 ? await db.review.findMany({ where: { bookId: { in: bookIds } }, select: { id: true } }) : [];
    const reviewsByUser = await db.review.findMany({ where: { userId }, select: { id: true } });
    const blogs = await db.blog.findMany({ where: { authorId: userId }, select: { id: true } });
    const orders = await db.order.findMany({ where: { reader: { user: { id: userId } } }, select: { id: true } });

    const ids = clean([
      ...bookIds,
      ...reviewsOnBooks.map((r: { id: string }) => r.id),
      ...reviewsByUser.map((r: { id: string }) => r.id),
      ...blogs.map((b: { id: string }) => b.id),
      ...orders.map((o: { id: string }) => o.id),
    ]);
    return async () => deleteNotificationsForRecords(ids, db);
  } catch {
    return NOOP;
  }
}

/* ------------------------------------------------------------------ *
 * Status changes
 * ------------------------------------------------------------------ *
 * The rule above covers an item being DELETED. The same rule applies
 * when an item's status moves on: a notification that announces a state
 * the item is no longer in must go too. Example: "Revision requested"
 * must not stay in the author's list after the book is approved, and
 * "Your book has been published" must not stay after it is suspended or
 * deleted; a payout's "Payout rejected" must not sit beside "Payout
 * sent". These helpers are called by the action that changes the status,
 * just before it creates the notification for the new status.
 */

/** Notification types that announce a book being live / needing work. */
export const BOOK_LIVE_NOTIFICATION_TYPES = ["BOOK_PUBLISHED", "NEW_BOOK_BY_FOLLOWED_AUTHOR"] as const;
export const BOOK_NOT_LIVE_NOTIFICATION_TYPES = ["REVISION"] as const;
export const BLOG_LIVE_NOTIFICATION_TYPES = ["BLOG_PUBLISHED"] as const;
export const BLOG_NOT_LIVE_NOTIFICATION_TYPES = ["BLOG_REVISION"] as const;
/** Title prefixes of the "an editor proposed…" notices sent to approvers. */
export const MODERATION_PROPOSAL_TITLE_PREFIXES = ["Suspend proposed", "Withdraw proposed"] as const;

/** Pure: builds the Prisma filter for superseded notifications. */
export function supersededWhere(recordId: string, types: readonly string[], titlePrefixes?: readonly string[]) {
  return {
    relatedRecordId: recordId,
    type: { in: [...types] },
    ...(titlePrefixes && titlePrefixes.length > 0 ? { OR: titlePrefixes.map((p) => ({ title: { startsWith: p } })) } : {}),
  };
}

/** Deletes the notifications of one record that announce a status it has
 * now left. Never throws. */
export async function clearSupersededNotifications(
  recordId: string,
  types: readonly string[],
  titlePrefixes?: readonly string[],
  db: Db = prisma,
): Promise<void> {
  try {
    await db.notification.deleteMany({ where: supersededWhere(recordId, types, titlePrefixes) });
  } catch {
    // Best-effort: never block the status change.
  }
}

/** The book is now live: older "revision requested / suspended /
 * withdrawn / proposed" notices about it are obsolete. */
export const clearBookNotLiveNotices = (bookId: string) => clearSupersededNotifications(bookId, BOOK_NOT_LIVE_NOTIFICATION_TYPES);
/** The book is no longer live (rejected, suspended, withdrawn, deleted
 * by the author): "published" notices (to the author and to followers)
 * and older revision notices are obsolete. */
export const clearBookLiveNotices = (bookId: string) =>
  clearSupersededNotifications(bookId, [...BOOK_LIVE_NOTIFICATION_TYPES, ...BOOK_NOT_LIVE_NOTIFICATION_TYPES]);
/** An editor's proposal was ratified or declined: the request is closed. */
export const clearModerationProposalNotices = (bookId: string) =>
  clearSupersededNotifications(bookId, BOOK_NOT_LIVE_NOTIFICATION_TYPES, MODERATION_PROPOSAL_TITLE_PREFIXES);
export const clearBlogNotLiveNotices = (blogId: string) => clearSupersededNotifications(blogId, BLOG_NOT_LIVE_NOTIFICATION_TYPES);
export const clearBlogLiveNotices = (blogId: string) =>
  clearSupersededNotifications(blogId, [...BLOG_LIVE_NOTIFICATION_TYPES, ...BLOG_NOT_LIVE_NOTIFICATION_TYPES]);
/** A payout is resolved: any earlier outcome notice for it is replaced. */
export const clearPayoutNotices = (payoutId: string) => clearSupersededNotifications(payoutId, ["PAYOUT"]);
