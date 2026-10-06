/**
 * Which payout methods a user may currently choose. Bank transfer is
 * always available. PayPal (stored type "email") and M-Pesa (stored type
 * "mpesa") are available only when an admin switches them on in Site
 * Settings (stored as paypalPayoutsEnabled / mpesaPayoutsEnabled in the
 * site settings JSON, both OFF by default). These are PAYOUT toggles and
 * are unrelated to the checkout payment settings (Paystack etc).
 *
 * Pure so it can be shared by the UI, the server actions and the tests.
 * Records a user already saved for a switched-off method are never
 * deleted; they just can't be newly added, activated or edited.
 */

export const PAYOUT_METHOD_UNAVAILABLE_MESSAGE = "Currently, we do not accept payouts using this method.";

export interface PayoutMethodToggles {
  paypalPayoutsEnabled: boolean;
  mpesaPayoutsEnabled: boolean;
}

export const DEFAULT_PAYOUT_METHOD_TOGGLES: PayoutMethodToggles = {
  paypalPayoutsEnabled: false,
  mpesaPayoutsEnabled: false,
};

/** Anything other than a literal `true` counts as OFF. */
export function resolvePayoutMethodToggles(stored: { paypalPayoutsEnabled?: unknown; mpesaPayoutsEnabled?: unknown } | null | undefined): PayoutMethodToggles {
  return {
    paypalPayoutsEnabled: stored?.paypalPayoutsEnabled === true,
    mpesaPayoutsEnabled: stored?.mpesaPayoutsEnabled === true,
  };
}

/** `type` is the stored recipient type: "email" = PayPal, "mpesa" = M-Pesa,
 * "bank" (and the older bank-style keys) = bank transfer. */
export function isPayoutMethodTypeAvailable(type: string, toggles: PayoutMethodToggles): boolean {
  const t = type.trim().toLowerCase();
  if (t === "email") return toggles.paypalPayoutsEnabled;
  if (t === "mpesa") return toggles.mpesaPayoutsEnabled;
  return true;
}
