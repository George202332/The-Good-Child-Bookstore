import { prisma } from "@/lib/prisma";
import { createNotification } from "@/actions/notifications";

/**
 * Notifies everyone who actually earned real money on this now-PAID
 * order — the author of each line's book (a royalty — "SALE" plus the
 * Revenue-tab-blinking "REVENUE_ROYALTY", see lib/notification-types.ts),
 * the affiliate who referred that book's author onto the platform, if
 * any ("REVENUE_REFERRAL"), and the affiliate whose own promotional
 * link the sale came through, if any ("REVENUE_PROMOTION").
 *
 * Shared by BOTH order-confirmation paths — actions/orders.ts
 * confirmOrderPaidDirectly (the no-gateway-configured demo fallback)
 * and lib/payments/finalize.ts finalizeOrderPayment (the real Paystack
 * webhook/return-flow path) — specifically so they can never drift out
 * of sync again. Before this file existed:
 *   - Only the gateway path notified the author of a sale at all; the
 *     demo-mode path (confirmOrderPaidDirectly) notified the buyer
 *     ("Payment received") but never the author whose book it was.
 *   - NEITHER path ever notified an affiliate about a referral or
 *     promotion commission — those earnings were correctly recorded on
 *     the SaleLine itself (see actions/orders.ts createPendingOrder)
 *     and correctly counted everywhere the earnings are summed, but
 *     the affiliate who earned them had no actual notification (and,
 *     before this round, no "Revenue" sidebar blink either — see
 *     components/DashboardShell.tsx) telling them so.
 *
 * Deliberately format-agnostic: every SaleLine is treated identically
 * regardless of its `format` (eBook/Paperback/Hardcover/Audiobook) —
 * whichever of authorShare/authorReferralShare/affiliateShare is
 * nonzero on the line decides who gets notified, same as everywhere
 * else real money is computed from a SaleLine.
 */
export async function notifyRevenueEarners(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        lines: {
          include: {
            book: { include: { author: { include: { user: true } } } },
            affiliateLink: { include: { affiliate: { include: { user: true } } } },
            authorReferralAffiliate: { include: { user: true } },
          },
        },
      },
    });
    if (!order) return;

    type LineWithEarners = {
      id: string;
      authorShare: unknown;
      authorReferralShare: unknown;
      affiliateShare: unknown;
      book: { title: string; author: { user: { id: string } } };
      affiliateLink: { affiliate: { user: { id: string } } } | null;
      authorReferralAffiliate: { user: { id: string } } | null;
    };

    for (const line of order.lines as LineWithEarners[]) {
      const authorShare = Number(line.authorShare);
      const authorReferralShare = Number(line.authorReferralShare);
      const affiliateShare = Number(line.affiliateShare);

      if (authorShare > 0) {
        // One notification per SaleLine (its own id as relatedRecordId,
        // same pattern as lib/payments/finalize.ts always used) so
        // deleting that specific transaction later
        // (actions/transactions.ts deleteTransaction) can find and
        // remove exactly these notifications, never leaving a trace.
        await createNotification(
          line.book.author.user.id,
          line.book.title,
          `A copy of "${line.book.title}" just sold.`,
          "SALE",
          line.id
        );
        await createNotification(
          line.book.author.user.id,
          line.book.title,
          `You earned $${authorShare.toFixed(2)} in royalties on "${line.book.title}".`,
          "REVENUE_ROYALTY",
          line.id
        );
      }

      if (line.authorReferralAffiliate && authorReferralShare > 0) {
        await createNotification(
          line.authorReferralAffiliate.user.id,
          line.book.title,
          `You earned $${authorReferralShare.toFixed(2)} in referral commission from "${line.book.title}".`,
          "REVENUE_REFERRAL",
          line.id
        );
      }

      if (line.affiliateLink && affiliateShare > 0) {
        await createNotification(
          line.affiliateLink.affiliate.user.id,
          line.book.title,
          `You earned $${affiliateShare.toFixed(2)} in promotion commission from "${line.book.title}".`,
          "REVENUE_PROMOTION",
          line.id
        );
      }
    }
  } catch {
    // Non-critical — a failed notification shouldn't block payment confirmation.
  }
}
