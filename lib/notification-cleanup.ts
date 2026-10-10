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
