import { redirect } from "next/navigation";
import { verifyPaystackTransaction } from "@/lib/payments/paystack";
import { finalizeOrderPayment } from "@/lib/payments/finalize";
import { saveCardIfReusable } from "@/actions/payment-methods";
import { prisma } from "@/lib/prisma";

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
  searchParams: Promise<{ gateway?: string; orderId?: string; reference?: string; trxref?: string }>;
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
        const { success, ourOrderId, authorization } = await verifyPaystackTransaction(reference);
        if (success && ourOrderId) {
          await finalizeOrderPayment(ourOrderId, "PAYSTACK", { source: "return_redirect", reference });
          await saveCardIfReusable(ourOrderId, authorization);
          redirect(`/checkout/confirmation?order=${ourOrderId}`);
        }
      } catch (e) {
        // Swallow and fall through to the DB-status fallback below —
        // re-throwing here (including Next.js's own redirect() control
        // flow, which uses a thrown value internally) must not happen,
        // since that's exactly what would crash the page. redirect()
        // calls above already exited before this catch if they ran.
        if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
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
      redirect(`/checkout/confirmation?order=${orderId}`);
    }
  }

  // Payment wasn't confirmed by either path — back to checkout rather
  // than a fake success.
  redirect("/checkout?payment_failed=1");
}
