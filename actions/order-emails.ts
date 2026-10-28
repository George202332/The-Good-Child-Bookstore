import { sendPurchaseEmail } from "@/lib/email/purchase";

/**
 * Entry point used by the two places that confirm an order as paid
 * (lib/payments/finalize.ts for the real Paystack/PayPal path, and
 * actions/orders.ts confirmOrderPaidDirectly for demo mode). All the real
 * work (who gets which version of the email, the once-only guarantee, the
 * set-password link) lives in lib/email/purchase.ts.
 *
 * Deliberately NOT a "use server" file: it must never be callable from a
 * browser, only from server code that has already confirmed payment.
 * It never throws, so an email problem can never undo a successful purchase;
 * failures are reported to Site Health instead of being silently swallowed.
 */
export async function sendOrderReceiptEmail(orderId: string, opts?: { onlyIfRecent?: boolean }): Promise<void> {
  await sendPurchaseEmail(orderId, opts);
}
