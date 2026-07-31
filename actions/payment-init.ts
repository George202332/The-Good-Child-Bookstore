"use server";

import { initializePaystackTransaction } from "@/lib/payments/paystack";
import { getPaystackCredentials } from "@/lib/api-keys";

/**
 * Starts a real hosted Paystack checkout when credentials are
 * configured; otherwise reports back so the caller (checkout page) can
 * fall back to demo mode (confirmOrderPaidDirectly in
 * actions/orders.ts) — the same behavior this app has had all along.
 *
 * PayPal removed entirely per explicit instruction — checkout only
 * takes cards via Paystack now. "mpesa" is not a separate gateway
 * integration — Paystack supports M-Pesa directly as a mobile money
 * channel, so selecting it just calls Paystack with
 * channels: ["mobile_money"] instead of the default card flow. The
 * charge itself stays in USD (our one true currency) — Paystack
 * converts to KES at their own standard rates when settling to M-Pesa,
 * so no manual USD->KES conversion happens on our side.
 */

export interface InitiateGatewayResult {
  ok: boolean;
  configured: boolean;
  redirectUrl?: string;
  error?: string;
}

/**
 * The real site URL for payment gateway return/callback URLs. This was
 * the cause of the "localhost refused to connect" bug after a real
 * payment: it always fell back to a hardcoded localhost address unless
 * NEXT_PUBLIC_SITE_URL was manually set in Vercel, which it wasn't.
 * Vercel automatically provides VERCEL_URL on every deployment (no
 * manual setup needed), so that's used as the real fallback now —
 * NEXT_PUBLIC_SITE_URL still wins if it's explicitly set (e.g. once a
 * custom domain is attached), and localhost is only used for actual
 * local development.
 */
function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function initiateGatewayCheckout(
  orderId: string,
  method: "paystack" | "mpesa",
  amountUsd: number,
  email: string
): Promise<InitiateGatewayResult> {
  const base = siteUrl();

  const { secretKey: paystackKey } = await getPaystackCredentials();
  if (!paystackKey) {
    return { ok: true, configured: false };
  }
  try {
    const { authorizationUrl } = await initializePaystackTransaction(
      email,
      Math.round(amountUsd * 100),
      orderId,
      `${base}/checkout/return?gateway=paystack&orderId=${orderId}`,
      method === "mpesa" ? { channels: ["mobile_money"] } : undefined
    );
    return { ok: true, configured: true, redirectUrl: authorizationUrl };
  } catch (e) {
    return { ok: false, configured: true, error: e instanceof Error ? e.message : "Paystack error." };
  }
}
