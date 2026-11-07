import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyRevenueEarners } from "@/lib/payments/notify-earners";
import { reportSystemError } from "@/lib/site-health/alert";

/** Marks an order PAID and logs the payment — shared by the webhook
 * handlers (app/api/webhooks/*) and the gateway return flow
 * (app/checkout/return), so both paths record identically.
 *
 * The core PAID-marking + payment-log write is the one part of this
 * function that genuinely can't fail silently — a buyer whose payment
 * succeeded but whose order never got marked PAID is exactly the kind
 * of thing Site Health's "payment and checkout" alert exists for — so
 * it's wrapped and reported through reportSystemError() before
 * re-throwing (both callers already handle a thrown error from this
 * function: the webhook route lets it 500 so Paystack retries, and the
 * return-page catch falls back to its own DB-status check). */
/** Whether this payment was made with test money or real money, saved on the payment record so a test payment can
 * never later be treated as a real one (see lib/print-submission-guard.ts). Never contains a key: only "test" or "live". */
async function gatewayModeOf(gateway: "PAYSTACK" | "PAYPAL", rawPayload: unknown): Promise<"test" | "live"> {
  try {
    const { getPaystackCredentials, getPaypalCredentials } = await import("@/lib/api-keys");
    if (gateway === "PAYPAL") return (await getPaypalCredentials()).environment === "live" ? "live" : "test";
    const domain = (rawPayload as { data?: { domain?: unknown } } | null)?.data?.domain;
    if (domain === "test") return "test";
    const c = await getPaystackCredentials();
    if (c.secretKey?.startsWith("sk_test_")) return "test";
    if (c.secretKey?.startsWith("sk_live_")) return "live";
    return c.mode === "live" ? "live" : "test";
  } catch {
    return "test"; // when in doubt, treat it as test money: the print job is held, never wrongly sent
  }
}

export async function finalizeOrderPayment(
  orderId: string,
  gateway: "PAYSTACK" | "PAYPAL",
  rawPayload: unknown,
  /** Webhooks pass defer:true: the payment is recorded and the gateway is answered at once, and the follow-up work (notices,
   * print job, receipt e-mail) runs right after the reply. The scheduled order-retry job repeats the print job and the receipt
   * if either failed. The buyer's return page keeps the default (follow-up before the page shows, so it can show the print status). */
  opts: { defer?: boolean } = {}
): Promise<void> {
  let order;
  let claimedHere = false;
  try {
    // Only a PENDING order can become PAID, and only once: the return page and
    // the webhook both call this, and whichever arrives second must not repeat
    // the sale notices, print jobs and receipt email.
    const claimed = await prisma.order.updateMany({ where: { id: orderId, status: "PENDING" }, data: { status: "PAID" } });
    if (claimed.count === 0) {
      // Already confirmed by the other path (webhook vs return page). Nothing else
      // to repeat, but if the purchase email failed the first time this is a
      // chance to send it; it is a no-op when it was already sent.
      const { sendOrderReceiptEmail } = await import("@/actions/order-emails");
      await sendOrderReceiptEmail(orderId, { onlyIfRecent: true });
      return;
    }
    claimedHere = true;
    order = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        reader: { include: { user: true } },
      },
    });
    const siteGatewayMode = await gatewayModeOf(gateway, rawPayload);
    const base = rawPayload && typeof rawPayload === "object" && !Array.isArray(rawPayload) ? (rawPayload as Record<string, unknown>) : { payload: rawPayload ?? null };
    await prisma.paymentLog.create({
      data: { orderId, gateway, rawPayload: { ...base, siteGatewayMode } as object, verified: true },
    });
    // Processing Fee orders only: save what the gateway really kept (read from its own payload) so Accounting and Site Health can
    // compare it with the fee charged. Never blocks the payment: a failure here is logged and the estimate is used later.
    try {
      if (order.processingFeeAmount != null && Number(order.processingFeeAmount) > 0) {
        const { gatewayFeeFromPayload, estimateGatewayCost, normalizeRates } = await import("@/lib/processing-fee");
        const actual = gatewayFeeFromPayload(gateway, rawPayload);
        let cost = actual;
        let source = "gateway";
        if (cost == null) {
          const { getFeeRates } = await import("@/lib/processing-fee-settings");
          const rates = await getFeeRates().catch(() => normalizeRates(null));
          const route = (order.processingFeeGateway as keyof typeof rates | null) ?? (gateway === "PAYPAL" ? "paypal" : "paystack");
          cost = estimateGatewayCost(Number(order.totalAmount), rates[route]);
          source = "estimate";
        }
        await prisma.order.update({ where: { id: orderId }, data: { gatewayCostActual: cost, gatewayCostSource: source } });
      }
    } catch (e) {
      console.error("[finalize] could not save the gateway cost:", e instanceof Error ? e.message : e);
    }
  } catch (e) {
    // Put the order back to PENDING so Paystack's retry (or the buyer's return) can finish the job.
    if (claimedHere) {
      await prisma.order.updateMany({ where: { id: orderId, status: "PAID" }, data: { status: "PENDING" } }).catch(() => undefined);
    }
    await reportSystemError("CHECKOUT", e, { orderId, gateway });
    throw e;
  }

  const followUp = async () => {
  try {
      await prisma.notification.create({
        data: {
          userId: order.reader.user.id,
          title: "Order confirmed",
          body: `Your order #${orderId.slice(0, 8).toUpperCase()} for $${Number(order.totalAmount).toFixed(2)} is confirmed.`,
          type: "PAYMENT",
          // Tied to the order so deleting the order removes this too.
          relatedRecordId: orderId,
        },
      });
    } catch {
      // Non-critical — a failed notification shouldn't block payment confirmation.
    }
  
    // Notifies the author of each line's book ("You've got a sale" on
    // their Recent Activity, plus the Revenue-tab blink), and any
    // referring/promoting affiliate of their own commission — see
    // lib/payments/notify-earners.ts, now shared with the demo-mode
    // confirmation path (actions/orders.ts confirmOrderPaidDirectly) so
    // the two can't drift out of sync again.
    await notifyRevenueEarners(orderId);
  
    // Any physical copies in this order get submitted to Lulu as a real
    // print-on-demand job — never allowed to block payment confirmation
    // if it fails, since the customer's payment already succeeded.
    const { submitPrintJobsForOrder } = await import("@/lib/payments/lulu");
    await submitPrintJobsForOrder(orderId);
  
    const { sendOrderReceiptEmail } = await import("@/actions/order-emails");
    await sendOrderReceiptEmail(orderId);
  };

  if (opts.defer) {
    after(async () => {
      try { await followUp(); } catch (e) { await reportSystemError("CHECKOUT", e, { orderId, gateway, stage: "follow-up" }); }
    });
    return;
  }
  await followUp();
}
