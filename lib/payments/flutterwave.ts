/**
 * Flutterwave — ARCHITECTURE ONLY, per the brief ("Flutterwave (prepare
 * architecture)"). Not implemented; this file exists so the intended
 * integration point is documented: Flutterwave's Standard Checkout
 * (POST /v3/payments to get a hosted payment link, similar shape to
 * Paystack's initialize/verify pair in lib/payments/paystack.ts), verified
 * via their webhook's `verif-hash` header against FLUTTERWAVE_SECRET_HASH.
 */
export {};
