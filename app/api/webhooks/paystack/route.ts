import { NextResponse } from "next/server";
import { verifyPaystackWebhookSignature, verifyPaystackTransaction } from "@/lib/payments/paystack";
import { finalizeOrderPayment } from "@/lib/payments/finalize";
import { saveCardIfReusable } from "@/actions/payment-methods";

/** Paystack webhook — same verify → split (already computed at order
 * time) → record → email → dashboard-update flow as the PayPal handler. */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");

  if (!verifyPaystackWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  if (event.event !== "charge.success") {
    return NextResponse.json({ ok: true, ignored: event.event });
  }

  const reference = event.data?.reference;
  if (!reference) return NextResponse.json({ error: "No reference in payload" }, { status: 400 });

  const { success, ourOrderId, authorization } = await verifyPaystackTransaction(reference);
  if (!success || !ourOrderId) {
    return NextResponse.json({ ok: true, verified: false });
  }

  await finalizeOrderPayment(ourOrderId, "PAYSTACK", event);
  await saveCardIfReusable(ourOrderId, authorization);

  return NextResponse.json({ ok: true });
}
