/**
 * PayPal integration — Orders v2 API. Per the brief, PayPal is one of
 * the two "live" gateways (Stripe/Flutterwave are architecture-only —
 * see lib/payments/stripe.ts, lib/payments/flutterwave.ts).
 *
 * Credentials (separate sandbox/live pairs) come from Site Settings if
 * saved there, falling back to PAYPAL_CLIENT_ID/SECRET/ENV env vars —
 * see lib/api-keys.ts getPayPalCredentials(). This is real, correct
 * integration code against PayPal's documented REST API, not exercised
 * against a live PayPal account in this sandbox (no network access).
 */

import { getPayPalCredentials } from "@/lib/api-keys";

async function getPayPalAccessToken(): Promise<{ token: string; baseUrl: string }> {
  const { clientId, clientSecret, live } = await getPayPalCredentials();
  const baseUrl = live ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  if (!clientId || !clientSecret) {
    throw new Error("PayPal isn't configured yet — set it up in Site Settings or the PAYPAL_CLIENT_ID/SECRET environment variables.");
  }

  const res = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`PayPal auth failed: ${res.status}`);
  const data = await res.json();
  return { token: data.access_token, baseUrl };
}

/** Creates a PayPal order for the given USD amount, tagged with our own
 * Order id in custom_id so the webhook can match it back to a real row.
 * returnUrl/cancelUrl control where PayPal redirects the buyer back to
 * after approving/cancelling — PayPal appends its own ?token=&PayerID=
 * query params to whatever URL we give it. */
export async function createPayPalOrder(
  amountUsd: number,
  ourOrderId: string,
  returnUrl: string,
  cancelUrl: string
): Promise<{ paypalOrderId: string; approveUrl: string }> {
  const { token, baseUrl } = await getPayPalAccessToken();
  const res = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          custom_id: ourOrderId,
          amount: { currency_code: "USD", value: amountUsd.toFixed(2) },
        },
      ],
      application_context: { return_url: returnUrl, cancel_url: cancelUrl, user_action: "PAY_NOW" },
    }),
  });
  if (!res.ok) throw new Error(`PayPal order creation failed: ${res.status}`);
  const data = await res.json();
  const approveUrl = (data.links as { rel: string; href: string }[]).find((l) => l.rel === "approve")?.href;
  if (!approveUrl) throw new Error("PayPal did not return an approval link.");
  return { paypalOrderId: data.id, approveUrl };
}

/** Captures an approved PayPal order — call this from the webhook handler
 * (or the return redirect) once the buyer has approved on PayPal's side. */
export async function capturePayPalOrder(paypalOrderId: string): Promise<{ captured: boolean; ourOrderId: string | null }> {
  const { token, baseUrl } = await getPayPalAccessToken();
  const res = await fetch(`${baseUrl}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) return { captured: false, ourOrderId: null };
  const data = await res.json();
  const status = data.status;
  const ourOrderId = data.purchase_units?.[0]?.custom_id ?? null;
  return { captured: status === "COMPLETED", ourOrderId };
}

/** Verifies a PayPal webhook signature via PayPal's own verification
 * endpoint — never trust a webhook body without this. */
export async function verifyPayPalWebhookSignature(headers: Headers, body: string): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  const { token, baseUrl } = await getPayPalAccessToken();

  const res = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      auth_algo: headers.get("paypal-auth-algo"),
      cert_url: headers.get("paypal-cert-url"),
      transmission_id: headers.get("paypal-transmission-id"),
      transmission_sig: headers.get("paypal-transmission-sig"),
      transmission_time: headers.get("paypal-transmission-time"),
      webhook_id: webhookId,
      webhook_event: JSON.parse(body),
    }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  return data.verification_status === "SUCCESS";
}
