import { redirect } from "next/navigation";
import { confirmPaystackReference } from "@/lib/payments/paystack-confirm";
import { capturePaypalOrder, evaluatePaypalCapture } from "@/lib/payments/paypal";
import { finalizeOrderPayment } from "@/lib/payments/finalize";
import { saveCardIfReusable } from "@/actions/payment-methods";
import { prisma } from "@/lib/prisma";
import { confirmationUrl } from "@/lib/order-access";

/**
 * Where to send the buyer once payment is confirmed. The link carries the order's
 * secret key (so a guest with no login can open the page and download the
 * receipt) ONLY when the visitor has just proved they are the buyer: the payment
 * reference / PayPal token from the gateway's own redirect matches this order's
 * payment record. Otherwise the plain link is used, which only the signed-in
 * owner can open. This stops anyone who merely knows an order number from being
 * handed the key by visiting this return page.
 */
async function successUrl(orderId: string, proof: string | undefined): Promise<string> {
  if (proof) {
    try {
      const logs = await prisma.paymentLog.findMany({ where: { orderId }, select: { rawPayload: true } });
      if (logs.some((l) => JSON.stringify(l.rawPayload).includes(proof))) return confirmationUrl(orderId);
    } catch {
      // Fall through to the plain link.
    }
  }
  return `/checkout/confirmation?order=${encodeURIComponent(orderId)}`;
}

/**
 * Where Paystack redirects the buyer back to after they pay on its own
 * hosted page. This is the client-facing half of confirmation — the
 * webhook (app/api/webhooks/paystack) is the authoritative,
 * server-to-server half; both call the same finalizeOrderPayment() so
 * an order that's confirmed either way ends up identically recorded.
 */
export default async function CheckoutReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ gateway?: string; orderId?: string; reference?: string; trxref?: string; token?: string }>;
}) {
  const params = await searchParams;
  const { gateway, orderId } = params;

  if (!gateway || !orderId) redirect("/checkout");

  if (gateway === "paystack") {
    const reference = params.reference ?? params.trxref;
    if (reference) {
      // The verify/finalize chain is wrapped defensively — a transient
      // error here (network hiccup, a slow DB connection, anything
      // unexpected) must never crash this page into a generic error
      // screen for a buyer who may have genuinely already paid.
      try {
        const confirmed = await confirmPaystackReference(reference);
        // Only a payment that is for this order, in USD, for the exact total is accepted.
        if (confirmed.ok && confirmed.orderId === orderId) {
          await finalizeOrderPayment(confirmed.orderId, "PAYSTACK", { source: "return_redirect", reference });
          await saveCardIfReusable(confirmed.orderId, confirmed.authorization);
          // Paystack itself just confirmed this payment for this order: the buyer is proven.
          redirect(confirmationUrl(confirmed.orderId));
        }
        if (!confirmed.ok) {
          const st = confirmed.paystackStatus;
          // Paystack says the payment is still being processed: show the honest "waiting" page.
          if (st === "pending" || st === "ongoing" || st === "processing" || st === "queued") {
            // The reference is Paystack's own and was made for this very order.
            redirect(reference.startsWith(`gcb-${orderId}-`) ? confirmationUrl(orderId) : `/checkout/confirmation?order=${encodeURIComponent(orderId)}`);
          }
          // Paystack says the payment definitely failed: record that (only a PENDING order moves).
          if (st === "failed") {
            await prisma.order.updateMany({ where: { id: orderId, status: "PENDING" }, data: { status: "FAILED" } });
          }
        }
      } catch (e) {
        // Swallow and fall through to the DB-status fallback below —
        // re-throwing here (including Next.js's own redirect() control
        // flow, which uses a thrown value internally) must not happen,
        // since that's exactly what would crash the page. redirect()
        // calls above already exited before this catch if they ran.
        if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
        if (typeof e === "object" && e && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
      }
    }

    // Verification either wasn't attempted, errored, or didn't confirm
    // — before concluding payment failed, check our own order status
    // directly. The webhook is the authoritative confirmation path and
    // can mark an order PAID independently of (and possibly before)
    // this return-redirect ever runs, so a failed or errored
    // client-side verification here should never override a payment
    // that's already genuinely confirmed.
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
    if (order?.status === "PAID") {
      redirect(await successUrl(orderId, params.reference ?? params.trxref));
    }
  }

  if (gateway === "paypal") {
    // PayPal sends the buyer back with ?token=<PayPal order id> once they have
    // approved. We capture the money here, then only trust it if it is for THIS
    // order and exactly its total, as recorded in our own database.
    const paypalToken = params.token;
    if (paypalToken) {
      try {
        const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true, totalAmount: true } });
        if (order?.status === "PAID") redirect(await successUrl(orderId, paypalToken));
        if (order?.status === "PENDING") {
          const captured = await capturePaypalOrder(paypalToken);
          const verdict = evaluatePaypalCapture(captured, orderId, Number(order.totalAmount));
          if (verdict.ok) {
            await finalizeOrderPayment(orderId, "PAYPAL", { source: "return_redirect", paypalOrderId: paypalToken, captured });
            redirect(confirmationUrl(orderId));
          }
        }
      } catch (e) {
        if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
        // Next.js redirects carry a digest instead of the plain message.
        if (typeof e === "object" && e && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
      }
    }
    const paid = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true } });
    if (paid?.status === "PAID") redirect(await successUrl(orderId, params.token));
  }

  // Payment wasn't confirmed by either path — back to checkout rather
  // than a fake success.
  redirect("/checkout?payment_failed=1");
}
