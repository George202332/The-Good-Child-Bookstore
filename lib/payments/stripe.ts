/**
 * Stripe — ARCHITECTURE ONLY, per the brief ("Stripe (prepare
 * architecture)"). Not implemented; this file exists so the intended
 * integration point and shape are documented for whoever wires it in
 * for real: install the `stripe` package, create a PaymentIntent for the
 * order total, confirm on the client with Stripe.js/Elements, and verify
 * via the `payment_intent.succeeded` webhook event (same
 * create → verify → split → record → email → dashboard-update flow as
 * PayPal/Paystack in lib/payments/paypal.ts and paystack.ts).
 */
export {};
