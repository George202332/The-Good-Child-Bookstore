import { prisma } from "@/lib/prisma";
import { createNotification } from "@/actions/notifications";
import { reportSystemError } from "@/lib/site-health/alert";

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
 *
 * FRESH re-investigation (this round) of Site Health's repeated
 * "3-4 recent sale lines missing a notification" flag — the previous
 * round's conclusion (abandoned/unpaid checkouts correctly not
 * notified, see lib/site-health/checks.ts's PAID-order filter) is a
 * real, legitimate non-bug, but it does NOT explain this flag
 * recurring on sale lines that genuinely belong to PAID orders, which
 * is what George is reporting again now that real sales are flowing.
 *
 * The actual gap, found by tracing the whole loop below fresh: EVERY
 * line of an order was processed inside ONE shared try/catch around
 * the entire function. If notifying line #1 of a 4-line order
 * succeeds but line #2 throws (a null-ish relation, a transient DB
 * hiccup, `createNotification` itself failing) — line #2's error
 * aborts the loop entirely, so lines #3 and #4, which may have been
 * perfectly fine, NEVER get notified either, and the whole failure
 * was swallowed by a bare `catch {}` with literally zero trace left
 * anywhere (not even logged) — exactly the "3-4 sale lines" pattern:
 * one bad line cascades into silently dropping its neighbors in the
 * same order. This is a different, new root cause from the earnings-
 * counting (PAID-filter) bug two rounds ago — a notification-pipeline
 * gap, not an earnings-counting gap, matching the task's own framing
 * that these are two separate questions.
 *
 * The fix: each line's notification work now runs in its OWN try/catch
 * (so one line's failure can never take its siblings down with it)
 * and reports through reportSystemError("PAYOUT", ...) on failure, so
 * a real failure now leaves a trace in SystemErrorLog / Site Health's
 * "Logged errors" category instead of vanishing — if this happens
 * again, it will actually be visible, with which specific line and
 * error, rather than just a mystery count. Also fixes a second, real
 * gap this surfaced: before, a SALE+REVENUE_ROYALTY pair failing for
 * one author could silently also skip that SAME line's separate
 * REVENUE_REFERRAL/REVENUE_PROMOTION notifications to a DIFFERENT
 * person (the referring/promoting affiliate) — now each recipient's
 * notification for a line is independent of the others on that line
 * too.
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
        //
        // Isolated in its own try/catch (see the module comment above)
        // so a failure notifying THIS author never silently skips the
        // referral/promotion notifications below for a different
        // person on the same line, or any later line in this order.
        try {
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
        } catch (e) {
          await reportSystemError("PAYOUT", e, { action: "notifyRevenueEarners.royalty", orderId, saleLineId: line.id });
        }
      }

      if (line.authorReferralAffiliate && authorReferralShare > 0) {
        try {
          await createNotification(
            line.authorReferralAffiliate.user.id,
            line.book.title,
            `You earned $${authorReferralShare.toFixed(2)} in referral commission from "${line.book.title}".`,
            "REVENUE_REFERRAL",
            line.id
          );
        } catch (e) {
          await reportSystemError("PAYOUT", e, { action: "notifyRevenueEarners.referral", orderId, saleLineId: line.id });
        }
      }

      if (line.affiliateLink && affiliateShare > 0) {
        try {
          await createNotification(
            line.affiliateLink.affiliate.user.id,
            line.book.title,
            `You earned $${affiliateShare.toFixed(2)} in promotion commission from "${line.book.title}".`,
            "REVENUE_PROMOTION",
            line.id
          );
        } catch (e) {
          await reportSystemError("PAYOUT", e, { action: "notifyRevenueEarners.promotion", orderId, saleLineId: line.id });
        }
      }
    }
  } catch (e) {
    // The order fetch itself failing is the only thing left uncaught
    // above — still non-critical to payment confirmation, but now also
    // logged rather than silently swallowed, for the same reason as
    // every per-line catch above.
    await reportSystemError("PAYOUT", e, { action: "notifyRevenueEarners.fetchOrder", orderId });
  }
}
