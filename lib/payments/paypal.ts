import { getPaypalCredentials } from "@/lib/api-keys";

/**
 * PayPal checkout (REST Orders v2). The buyer is sent to PayPal to approve
 * the payment, returns to /checkout/return, and we then CAPTURE the money
 * and check it really is this order, in this amount, before marking it paid.
 *
 * Credentials come from Admin -> API Management (or the PAYPAL_CLIENT_ID /
 * PAYPAL_CLIENT_SECRET / PAYPAL_ENV environment variables) - see
 * lib/api-keys.ts getPaypalCredentials().
 */

export type PaypalEnvironment = "sandbox" | "live";

export function paypalBaseUrl(env: PaypalEnvironment): string {
  return env === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

/** PayPal wants the amount as a string with exactly two decimals. */
export function paypalAmountString(amountUsd: number): string {
  return (Math.round(amountUsd * 100) / 100).toFixed(2);
}

/** The body of the "create order" request. */
export function buildPaypalOrderBody(orderId: string, amountUsd: number, returnUrl: string, cancelUrl: string) {
  return {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: orderId,
        custom_id: orderId,
        description: `The Good Child Bookstore order ${orderId.slice(0, 8).toUpperCase()}`,
        amount: { currency_code: "USD", value: paypalAmountString(amountUsd) },
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: "The Good Child Bookstore",
          shipping_preference: "NO_SHIPPING",
          // PayPal's own page lets the buyer either log in with their PayPal account or
          // pay with a debit/credit card (guest checkout). Card numbers are only typed there.
          landing_page: "NO_PREFERENCE",
          user_action: "PAY_NOW",
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      },
    },
  };
}

interface PaypalLink { rel?: string; href?: string }

/** The page the buyer must visit to approve the payment. */
export function pickApprovalLink(links: PaypalLink[] | undefined): string | null {
  const link = (links ?? []).find((l) => l.rel === "payer-action") ?? (links ?? []).find((l) => l.rel === "approve");
  return link?.href ?? null;
}

interface PaypalOrderResponse {
  id?: string;
  status?: string;
  purchase_units?: {
    custom_id?: string;
    reference_id?: string;
    payments?: { captures?: { status?: string; amount?: { currency_code?: string; value?: string } }[] };
  }[];
}

/**
 * Decides whether a PayPal order response proves THIS order was paid:
 * completed, for our order id, in USD, for exactly the amount we expect.
 */
export function evaluatePaypalCapture(
  response: PaypalOrderResponse,
  expectedOrderId: string,
  expectedAmountUsd: number,
): { ok: true } | { ok: false; reason: string } {
  if (response.status !== "COMPLETED") return { ok: false, reason: `PayPal order status is ${response.status ?? "unknown"}.` };
  const unit = response.purchase_units?.[0];
  if (!unit) return { ok: false, reason: "PayPal returned no payment details." };
  if ((unit.custom_id ?? unit.reference_id) !== expectedOrderId) return { ok: false, reason: "This PayPal payment belongs to a different order." };
  const capture = unit.payments?.captures?.[0];
  if (!capture || capture.status !== "COMPLETED") return { ok: false, reason: "The PayPal payment has not been captured." };
  if (capture.amount?.currency_code !== "USD") return { ok: false, reason: "The PayPal payment was not in US dollars." };
  if (capture.amount?.value !== paypalAmountString(expectedAmountUsd)) return { ok: false, reason: "The PayPal amount does not match the order total." };
  return { ok: true };
}

export async function getAccessToken(): Promise<{ token: string; base: string }> {
  const { clientId, clientSecret, environment } = await getPaypalCredentials();
  if (!clientId || !clientSecret) throw new Error("PayPal isn't set up yet.");
  const base = paypalBaseUrl(environment);
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PayPal sign-in failed (${res.status}). Check the Client ID and Secret.`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error("PayPal did not return an access token.");
  return { token: data.access_token, base };
}

/** Checks the saved credentials (used by "Test PayPal connection"). */
export async function testPaypalCredentials(): Promise<void> {
  await getAccessToken();
}

/** Creates the PayPal order and returns the page the buyer approves it on. */
export async function createPaypalOrder(orderId: string, amountUsd: number, returnUrl: string, cancelUrl: string): Promise<{ approvalUrl: string; paypalOrderId: string }> {
  const { token, base } = await getAccessToken();
  const res = await fetch(`${base}/v2/checkout/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": `gcb-${orderId}` },
    body: JSON.stringify(buildPaypalOrderBody(orderId, amountUsd, returnUrl, cancelUrl)),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PayPal could not start the payment (${res.status}).`);
  const data = (await res.json()) as { id?: string; links?: PaypalLink[] };
  const approvalUrl = pickApprovalLink(data.links);
  if (!data.id || !approvalUrl) throw new Error("PayPal did not return a payment page.");
  return { approvalUrl, paypalOrderId: data.id };
}

/** Captures an approved PayPal order (or reads it back if it was already
 * captured, e.g. the buyer refreshed the return page). */
export async function capturePaypalOrder(paypalOrderId: string): Promise<PaypalOrderResponse> {
  const { token, base } = await getAccessToken();
  const res = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "PayPal-Request-Id": `gcb-capture-${paypalOrderId}` },
    cache: "no-store",
  });
  if (res.ok) return (await res.json()) as PaypalOrderResponse;
  const failure = (await res.json().catch(() => null)) as { details?: { issue?: string }[] } | null;
  if (failure?.details?.some((d) => d.issue === "ORDER_ALREADY_CAPTURED")) {
    const get = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (get.ok) return (await get.json()) as PaypalOrderResponse;
  }
  throw new Error(`PayPal could not capture the payment (${res.status}).`);
}

/** Reads an order back from PayPal (used by the webhook to check a payment for itself). */
export async function getPaypalOrder(paypalOrderId: string): Promise<PaypalOrderResponse> {
  const { token, base } = await getAccessToken();
  const res = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PayPal could not return the order (${res.status}).`);
  return (await res.json()) as PaypalOrderResponse;
}
