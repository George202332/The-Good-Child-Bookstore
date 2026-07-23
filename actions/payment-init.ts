"use server";

import { createPayPalOrder } from "@/lib/payments/paypal";
import { initializePaystackTransaction } from "@/lib/payments/paystack";

/**
 * Starts a real hosted checkout with PayPal or Paystack when credentials
 * are configured; otherwise reports back so the caller (checkout page)
 * can fall back to demo mode (confirmOrderPaidDirectly in
 * actions/orders.ts) — the same behavior this app has had all along.
 *
 * "mpesa" is not a separate gateway integration — Paystack supports
 * M-Pesa directly as a mobile money channel, so selecting it just calls
 * Paystack with channels: ["mobile_money"] instead of the default card
 * flow. The charge itself stays in USD (our one true currency) — Paystack
 * converts to KES at their own standard rates when settling to M-Pesa,
 * so no manual USD->KES conversion happens on our side.
 */

export interface InitiateGatewayResult {
  ok: boolean;
  configured: boolean;
  redirectUrl?: string;
  error?: string;
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function initiateGatewayCheckout(
  orderId: string,
  method: "paypal" | "paystack" | "mpesa",
  amountUsd: number,
  email: string
): Promise<InitiateGatewayResult> {
  const base = siteUrl();

  if (method === "paypal") {
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      return { ok: true, configured: false };
    }
    try {
      const { approveUrl } = await createPayPalOrder(
        amountUsd,
        orderId,
        `${base}/checkout/return?gateway=paypal&orderId=${orderId}`,
        `${base}/checkout?cancelled=1`
      );
      return { ok: true, configured: true, redirectUrl: approveUrl };
    } catch (e) {
      return { ok: false, configured: true, error: e instanceof Error ? e.message : "PayPal error." };
    }
  }

  // paystack (card) or mpesa (Paystack's mobile_money channel) — both USD
  if (!process.env.PAYSTACK_SECRET_KEY) {
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
