import { redirect } from "next/navigation";
import { verifyPaystackTransaction } from "@/lib/payments/paystack";
import { finalizeOrderPayment } from "@/lib/payments/finalize";
import { saveCardIfReusable } from "@/actions/payment-methods";

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
      const { success, ourOrderId, authorization } = await verifyPaystackTransaction(reference);
      if (success && ourOrderId) {
        await finalizeOrderPayment(ourOrderId, "PAYSTACK", { source: "return_redirect", reference });
        await saveCardIfReusable(ourOrderId, authorization);
        redirect(`/checkout/confirmation?order=${ourOrderId}`);
      }
    }
  }

  // Payment wasn't confirmed — back to checkout rather than a fake success.
  redirect("/checkout?payment_failed=1");
}
