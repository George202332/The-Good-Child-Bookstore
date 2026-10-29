import { NextResponse } from "next/server";
import { getPaypalWebhookId } from "@/lib/api-keys";
import { capturePaypalOrder, evaluatePaypalCapture, getPaypalOrder } from "@/lib/payments/paypal";
import { planPaypalEvent, verifyPaypalWebhook, type PaypalEvent } from "@/lib/payments/paypal-webhook";
import { finalizeOrderPayment } from "@/lib/payments/finalize";
import { prisma } from "@/lib/prisma";

/**
 * PayPal webhook - the server-to-server half of confirmation, the twin of
 * app/api/webhooks/paystack. Nothing is trusted from the request body:
 *   1. PayPal itself verifies the signature;
 *   2. the order is read back from PayPal (or captured) and checked against OUR order's
 *      id, currency (USD) and exact total;
 *   3. only then finalizeOrderPayment() runs - the same function Paystack uses, which can
 *      only move a PENDING order to PAID once, so a repeated event repeats nothing.
 * Pending, cancelled, denied or mismatching payments are ignored and create nothing.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const webhookId = getPaypalWebhookId();
  if (!webhookId) return NextResponse.json({ error: "PayPal webhook is not set up" }, { status: 503 });

  let event: PaypalEvent;
  try {
    event = JSON.parse(rawBody) as PaypalEvent;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  let verified = false;
  try {
    verified = await verifyPaypalWebhook(request.headers, webhookId, event);
  } catch {
    // Could not reach PayPal to verify: let PayPal retry later.
    return NextResponse.json({ error: "Could not verify the signature" }, { status: 503 });
  }
  if (!verified) return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });

  const plan = planPaypalEvent(event);
  if (!plan) return NextResponse.json({ ok: true, ignored: event.event_type ?? null });

  // Read the PayPal order to learn which of OUR orders it is for.
  const paypalOrder = plan.action === "capture" ? null : await getPaypalOrder(plan.paypalOrderId);
  const ourOrderId = plan.action === "capture"
    ? event.resource?.purchase_units?.[0]?.custom_id ?? event.resource?.purchase_units?.[0]?.reference_id
    : paypalOrder?.purchase_units?.[0]?.custom_id ?? paypalOrder?.purchase_units?.[0]?.reference_id;
  if (!ourOrderId) return NextResponse.json({ ok: true, verified: false });

  const order = await prisma.order.findUnique({ where: { id: ourOrderId }, select: { status: true, totalAmount: true } });
  if (!order) return NextResponse.json({ ok: true, verified: false });
  if (order.status === "PAID") {
    // Already confirmed (return page or an earlier event): finalize is a no-op that only retries a failed email.
    await finalizeOrderPayment(ourOrderId, "PAYPAL", { source: "webhook", eventId: event.id ?? null });
    return NextResponse.json({ ok: true });
  }
  if (order.status !== "PENDING") return NextResponse.json({ ok: true, verified: false });

  const result = plan.action === "capture" ? await capturePaypalOrder(plan.paypalOrderId) : paypalOrder!;
  const verdict = evaluatePaypalCapture(result, ourOrderId, Number(order.totalAmount));
  if (!verdict.ok) return NextResponse.json({ ok: true, verified: false });

  await finalizeOrderPayment(ourOrderId, "PAYPAL", { source: "webhook", eventId: event.id ?? null, paypalOrderId: plan.paypalOrderId, captured: result });
  return NextResponse.json({ ok: true });
}
