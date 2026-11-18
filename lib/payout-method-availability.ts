/**
 * Which payout methods a user may choose. The ONLY payout method is Bank
 * Transfer (stored type "bank"), paid through Verto.
 *
 * PayPal as a PAYOUT method is switched off here (the code is kept, so it can
 * be switched back on in one place). This has nothing to do with PayPal as a
 * CHECKOUT method for customers, its keys, webhooks or the footer card, which
 * are not touched. M-Pesa is removed completely.
 *
 * Records a user already saved for PayPal or M-Pesa are never deleted; they
 * just cannot be added, activated or edited, and the user is asked to choose
 * Bank Transfer.
 */

export const PAYOUT_METHOD_UNAVAILABLE_MESSAGE = "Bank Transfer is now the only way to receive payouts. Please add your bank details.";

/** The single switch for PayPal as a payout method. */
export const PAYPAL_PAYOUTS_ENABLED = false;

export function isPayoutMethodTypeAvailable(type: string): boolean {
  const t = type.trim().toLowerCase();
  if (t === "email") return PAYPAL_PAYOUTS_ENABLED;
  if (t === "mpesa") return false;
  return true;
}

/** True for the old payout types that now need the user to choose Bank Transfer. */
export function isLegacyPayoutType(type: string): boolean {
  const t = type.trim().toLowerCase();
  return t === "email" || t === "mpesa";
}
