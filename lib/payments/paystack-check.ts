/**
 * The rule that decides whether a Paystack payment may mark an order paid.
 * Paystack saying "success" is not enough on its own: the payment must also
 * be for THIS order, in US dollars, for exactly the order total held in our
 * own database (never an amount supplied by the browser).
 */
export function expectedMinorUnits(totalAmountUsd: number): number {
  return Math.round(totalAmountUsd * 100);
}

export function evaluatePaystackPayment(
  paid: { success: boolean; ourOrderId: string | null; amountMinor: number | null; currency: string | null },
  expectedOrderId: string,
  expectedTotalUsd: number,
): { ok: true } | { ok: false; reason: string } {
  if (!paid.success) return { ok: false, reason: "Paystack has not confirmed this payment." };
  if (paid.ourOrderId !== expectedOrderId) return { ok: false, reason: "This payment belongs to a different order." };
  if (paid.currency !== "USD") return { ok: false, reason: `The payment was made in ${paid.currency ?? "an unknown currency"}, not US dollars.` };
  if (paid.amountMinor !== expectedMinorUnits(expectedTotalUsd)) return { ok: false, reason: "The amount paid does not match the order total." };
  return { ok: true };
}
