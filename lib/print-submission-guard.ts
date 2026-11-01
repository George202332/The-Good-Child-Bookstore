/**
 * The last safety check before a print job is sent to Lulu. Pure, so the rules are tested.
 *
 * Lulu runs two separate systems: the SANDBOX (jobs are never printed or charged) and PRODUCTION (real printing, real
 * charges to the Lulu account). A real print job must NEVER be created unless a real payment has been confirmed. So, when
 * the order is headed for Lulu PRODUCTION, it is sent only if ALL of these hold:
 *
 *   1. a payment was confirmed for it by the payment gateway (a verified payment record: written only after Paystack
 *      or PayPal themselves confirmed it, through the webhook or the return page's own server-side check);
 *   2. that payment was made in the gateway's LIVE mode (a Paystack test key or a PayPal sandbox payment is test money);
 *   3. the order is not marked as test data.
 *
 * Otherwise the order is held (status HELD_TEST) with a plain explanation, and nothing is sent. Orders headed for the
 * Lulu SANDBOX are never held, because the sandbox never prints or charges anything.
 */

export type PaymentMode = "test" | "live";

export type SubmissionDecision =
  | { allow: true }
  | { allow: false; code: "no-verified-payment" | "test-payment" | "test-data"; message: string };

export const HELD_STATUS = "HELD_TEST";

export function printSubmissionDecision(opts: {
  luluEnvironment: "sandbox" | "production";
  /** Gateway of the latest verified payment record, or null when there is none. */
  gateway: "PAYSTACK" | "PAYPAL" | null;
  /** The mode that payment was made in, saved on the payment record when it was confirmed (null on older records). */
  paymentMode: PaymentMode | null;
  /** The gateway's current mode, used only when the payment record has no saved mode. */
  currentPaystackMode: PaymentMode;
  currentPaypalMode: PaymentMode;
  isTestData: boolean;
}): SubmissionDecision {
  if (opts.luluEnvironment !== "production") return { allow: true };
  if (!opts.gateway) {
    return { allow: false, code: "no-verified-payment", message: "Held: no confirmed payment is recorded for this order, so it was not sent to Lulu (live)." };
  }
  const mode = opts.paymentMode ?? (opts.gateway === "PAYSTACK" ? opts.currentPaystackMode : opts.currentPaypalMode);
  if (mode !== "live") {
    return { allow: false, code: "test-payment", message: `Held: this order was paid with ${opts.gateway === "PAYSTACK" ? "Paystack" : "PayPal"} test money, so it was not sent to Lulu (live). Nothing was printed or charged.` };
  }
  if (opts.isTestData) {
    return { allow: false, code: "test-data", message: "Held: this order is marked as test data, so it was not sent to Lulu (live). Nothing was printed or charged." };
  }
  return { allow: true };
}

/** The mode saved on a payment record's payload (see lib/payments/finalize.ts), or null when there is none. */
export function savedPaymentMode(rawPayload: unknown): PaymentMode | null {
  const m = (rawPayload as { siteGatewayMode?: unknown } | null)?.siteGatewayMode;
  return m === "test" || m === "live" ? m : null;
}
