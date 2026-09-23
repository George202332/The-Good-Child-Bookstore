import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyWiseWebhookSignature } from "@/lib/payments/wise";
import { createNotification } from "@/actions/notifications";

/**
 * Wise webhook — confirms what actually happened to a transfer, rather
 * than assuming "funded successfully" (the synchronous result of
 * fundWiseTransfer in approvePayoutRequest) means the money definitely
 * arrived. Wise's transfer lifecycle continues after funding
 * (processing → outgoing_payment_sent, or funds_refunded/cancelled if
 * something goes wrong downstream), and this is what lets the real,
 * final outcome update the PayoutRequest.
 *
 * Idempotency: the same event can be delivered more than once (Wise
 * retries on anything but a 2xx response, and any webhook provider can
 * duplicate-deliver). Guards against reprocessing two ways:
 *   1. An atomic updateMany that only transitions a payout out of PAID
 *      if it's currently in a real terminal state — a duplicate
 *      "outgoing_payment_sent" event for an already-PAID payout is a
 *      genuine no-op, not a second notification or a second state change.
 *   2. Unrecognized transfer ids (not ours, or already resolved) are
 *      acknowledged with 200 and ignored rather than erroring — Wise
 *      should never see this endpoint as broken and start retrying
 *      something that was never going to change.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature") ?? request.headers.get("x-signature-sha256");

  if (!(await verifyWiseWebhookSignature(rawBody, signature))) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let event: { event_type?: string; data?: { resource?: { id?: string | number; type?: string }; current_state?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const resource = event.data?.resource;
  if (!resource || resource.type !== "transfer" || resource.id == null) {
    // Not a transfer state-change event (Wise sends several event
    // types on the same endpoint) — acknowledge and ignore.
    return NextResponse.json({ ok: true, ignored: event.event_type ?? "unknown" });
  }

  const transferId = String(resource.id);
  const currentState = event.data?.current_state;

  const payout = await prisma.payoutRequest.findFirst({ where: { wiseTransferId: transferId } });
  if (!payout) {
    // Not a transfer this platform created (or already deleted) —
    // nothing to do, but still a valid, expected webhook delivery.
    return NextResponse.json({ ok: true, ignored: "unknown transfer" });
  }

  // Wise's real terminal states — see
  // https://docs.wise.com/api-docs/features/transfer-tracking
  const SUCCESS_STATES = ["outgoing_payment_sent", "funds_converted"];
  const FAILURE_STATES = ["funds_refunded", "cancelled", "bounced_back"];

  if (SUCCESS_STATES.includes(currentState ?? "")) {
    const claim = await prisma.payoutRequest.updateMany({
      where: { id: payout.id, status: { in: ["PROCESSING", "APPROVED", "REQUESTED"] } },
      data: { status: "PAID", resolvedAt: new Date() },
    });
    if (claim.count > 0) {
      await createNotification(payout.userId, "Payout sent", `Your $${Number(payout.amount).toFixed(2)} payout has been confirmed by Wise.`, "PAYOUT");
    }
  } else if (FAILURE_STATES.includes(currentState ?? "")) {
    const claim = await prisma.payoutRequest.updateMany({
      where: { id: payout.id, status: { in: ["PROCESSING", "APPROVED", "REQUESTED", "PAID"] } },
      data: { status: "REQUESTED", failureReason: `Wise reported: ${currentState}` },
    });
    if (claim.count > 0) {
      await createNotification(payout.userId, "Payout issue", `Wise reported a problem with your $${Number(payout.amount).toFixed(2)} payout (${currentState}). It's been returned to the queue for review.`, "PAYOUT");
    }
  }
  // Any other state (e.g. "processing", an intermediate step) is
  // acknowledged but doesn't change our status yet — only a real
  // success or failure state does.

  return NextResponse.json({ ok: true });
}
