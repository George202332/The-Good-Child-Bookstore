/**
 * The "Mode" shown in the admin transactions table: how the money moved.
 *   Paystack            - paid through Paystack
 *   PayPal - Card       - paid through PayPal with a debit/credit card
 *   PayPal - Email      - paid through PayPal with the buyer's PayPal account (email login)
 *   PayPal              - paid through PayPal, how not recorded
 * Payouts show the method the recipient is paid by.
 */

export type PaymentLogLike = { gateway: string; rawPayload: unknown } | null | undefined;

/** Reads a PayPal capture response and says whether a card or a PayPal account paid. */
export function paypalFundingKind(rawPayload: unknown): "card" | "email" | null {
  const root = (rawPayload ?? {}) as { captured?: { payment_source?: Record<string, unknown> }; payment_source?: Record<string, unknown> };
  const source = root.captured?.payment_source ?? root.payment_source;
  if (!source || typeof source !== "object") return null;
  if ("card" in source) return "card";
  if ("paypal" in source) return "email";
  return null;
}

export function saleModeLabel(log: PaymentLogLike): string {
  if (!log) return "—";
  if (log.gateway === "PAYSTACK") return "Paystack";
  if (log.gateway === "PAYPAL") {
    const kind = paypalFundingKind(log.rawPayload);
    return kind === "card" ? "PayPal - Card" : kind === "email" ? "PayPal - Email" : "PayPal";
  }
  return log.gateway.charAt(0) + log.gateway.slice(1).toLowerCase();
}

export function payoutModeLabel(recipientType: string | null | undefined): string {
  switch (recipientType) {
    case "email": return "PayPal - Email";
    case "bank": return "Bank transfer";
    case "mpesa": return "M-Pesa";
    default: return "—";
  }
}
