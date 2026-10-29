import { getAccessToken } from "@/lib/payments/paypal";

/**
 * PayPal webhook helpers. A webhook is trusted only after PayPal itself confirms its
 * signature (POST /v1/notifications/verify-webhook-signature), and even then the payment
 * is read back from PayPal and checked against OUR order before anything is marked paid.
 */

export const PAYPAL_SIGNATURE_HEADERS = [
  "paypal-auth-algo",
  "paypal-cert-url",
  "paypal-transmission-id",
  "paypal-transmission-sig",
  "paypal-transmission-time",
] as const;

/** The body PayPal's verification call expects, or null when a signature header is missing. */
export function buildVerifyBody(headers: { get(name: string): string | null }, webhookId: string, event: unknown) {
  const h: Record<string, string> = {};
  for (const name of PAYPAL_SIGNATURE_HEADERS) {
    const v = headers.get(name);
    if (!v) return null;
    h[name] = v;
  }
  return {
    auth_algo: h["paypal-auth-algo"],
    cert_url: h["paypal-cert-url"],
    transmission_id: h["paypal-transmission-id"],
    transmission_sig: h["paypal-transmission-sig"],
    transmission_time: h["paypal-transmission-time"],
    webhook_id: webhookId,
    webhook_event: event,
  };
}

export function isSuccessfulVerification(response: unknown): boolean {
  return (response as { verification_status?: string } | null)?.verification_status === "SUCCESS";
}

export async function verifyPaypalWebhook(headers: { get(name: string): string | null }, webhookId: string, event: unknown): Promise<boolean> {
  const body = buildVerifyBody(headers, webhookId, event);
  if (!body) return false;
  const { token, base } = await getAccessToken();
  const res = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) return false;
  return isSuccessfulVerification(await res.json().catch(() => null));
}

export interface PaypalEvent {
  id?: string;
  event_type?: string;
  resource?: {
    id?: string;
    custom_id?: string;
    supplementary_data?: { related_ids?: { order_id?: string } };
    purchase_units?: { custom_id?: string; reference_id?: string }[];
  };
}

/** What a webhook event asks us to do, or null for events we ignore. */
export function planPaypalEvent(event: PaypalEvent): { action: "capture" | "check"; paypalOrderId: string } | null {
  const r = event.resource;
  if (!r) return null;
  if (event.event_type === "CHECKOUT.ORDER.APPROVED" && r.id) return { action: "capture", paypalOrderId: r.id };
  if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
    const orderId = r.supplementary_data?.related_ids?.order_id;
    if (orderId) return { action: "check", paypalOrderId: orderId };
  }
  return null;
}
