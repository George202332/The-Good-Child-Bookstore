import { prisma } from "@/lib/prisma";

/**
 * Promotions (affiliate links) belong to a book. When a book is deleted,
 * withdrawn, suspended, rejected or otherwise taken off sale, the links that
 * promote it must go with it, the same way its notifications do.
 *
 * Links that already earned a commission are kept (their sale records point at
 * them and the affiliate's earnings history must stay intact). Those are simply
 * not shown: the "Books on Promotion" list only shows links whose book is live
 * (see actions/affiliate.ts), and they show again if the book is republished.
 *
 * Never throws: a failed cleanup must not block the book action that called it.
 */
export async function removeBookPromotions(bookId: string): Promise<number> {
  try {
    const removed = await prisma.affiliateLink.deleteMany({
      where: { bookId, saleLines: { none: {} } },
    });
    return removed.count;
  } catch {
    return 0;
  }
}
