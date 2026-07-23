import { NextResponse } from "next/server";
import { verifyPayPalWebhookSignature, capturePayPalOrder } from "@/lib/payments/paypal";
import { finalizeOrderPayment } from "@/lib/payments/finalize";

/**
 * PayPal webhook — the brief's "Webhook → Verification → Financial Split
 * → Database Record → Email → Dashboard Update" flow. Never trusts the
 * request body without verifying the signature first (verifyPayPalWebhookSignature).
 * The financial split itself already happened when the Order/SaleLine
 * rows were created (see actions/orders.ts placeOrder — the split is
 * computed once, at order time, not re-derived here); this webhook's job
 * is purely to confirm payment and record it.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();

  const verified = await verifyPayPalWebhookSignature(request.headers, rawBody).catch(() => false);
  if (!verified) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  if (event.event_type !== "CHECKOUT.ORDER.APPROVED" && event.event_type !== "PAYMENT.CAPTURE.COMPLETED") {
    return NextResponse.json({ ok: true, ignored: event.event_type });
  }

  const paypalOrderId = event.resource?.id;
  if (!paypalOrderId) return NextResponse.json({ error: "No order id in payload" }, { status: 400 });

  const { captured, ourOrderId } = await capturePayPalOrder(paypalOrderId);
  if (!captured || !ourOrderId) {
    return NextResponse.json({ ok: true, captured: false });
  }

  await finalizeOrderPayment(ourOrderId, "PAYPAL", event);

  return NextResponse.json({ ok: true });
}
