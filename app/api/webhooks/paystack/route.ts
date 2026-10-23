import { NextResponse } from "next/server";
import { verifyPaystackWebhookSignature } from "@/lib/payments/paystack";
import { confirmPaystackReference } from "@/lib/payments/paystack-confirm";
import { finalizeOrderPayment } from "@/lib/payments/finalize";
import { saveCardIfReusable } from "@/actions/payment-methods";

/** Paystack webhook — same verify → split (already computed at order
 * time) → record → email → dashboard-update flow as the PayPal handler. */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!(await verifyPaystackWebhookSignature(rawBody, signature))) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  if (event.event !== "charge.success") {
    return NextResponse.json({ ok: true, ignored: event.event });
  }

  const reference = event.data?.reference;
  if (!reference) return NextResponse.json({ error: "No reference in payload" }, { status: 400 });

  // Never trust the webhook body alone: ask Paystack, then check order, currency and amount.
  const confirmed = await confirmPaystackReference(reference);
  if (!confirmed.ok) {
    return NextResponse.json({ ok: true, verified: false });
  }

  await finalizeOrderPayment(confirmed.orderId, "PAYSTACK", event);
  await saveCardIfReusable(confirmed.orderId, confirmed.authorization);

  return NextResponse.json({ ok: true });
}
