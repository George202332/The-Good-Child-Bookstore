"use server";

import { initializePaystackTransaction } from "@/lib/payments/paystack";
import { getPaystackCredentials, getPaypalCredentials } from "@/lib/api-keys";
import { createPaypalOrder } from "@/lib/payments/paypal";
import { prisma } from "@/lib/prisma";
import { getPublicSiteUrl } from "@/lib/seo/site-url";

/**
 * Payment start-up for checkout: Paystack (cards) and PayPal. Everything
 * here runs on the server. If no gateway is configured, checkout says
 * payments are unavailable - there is no demo mode that marks orders paid.
 * "mpesa" is Paystack's mobile-money channel, not a separate gateway.
 */

export interface InitiateGatewayResult {
  ok: boolean;
  configured: boolean;
  redirectUrl?: string;
  error?: string;
}

/** Which online payment methods are switched on. Yes/no only - no keys leave the server. */
export async function getPaymentAvailability(): Promise<{ paystack: boolean; paypal: boolean }> {
  const [{ secretKey }, paypal] = await Promise.all([getPaystackCredentials(), getPaypalCredentials()]);
  return { paystack: !!secretKey, paypal: !!paypal.clientId && !!paypal.clientSecret };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Starts the hosted Paystack payment for an already-created pending order.
 * Runs on the server only: the secret key is read here and never reaches the
 * browser. The amount charged is read from OUR order record - the amount the
 * browser sends is ignored, so it cannot be tampered with.
 */
export async function initiateGatewayCheckout(
  orderId: string,
  method: "paystack" | "mpesa",
  _clientAmountUsd: number,
  email: string
): Promise<InitiateGatewayResult> {
  const base = getPublicSiteUrl();

  const { secretKey: paystackKey } = await getPaystackCredentials();
  if (!paystackKey) {
    return { ok: true, configured: false };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { status: true, totalAmount: true, reader: { select: { user: { select: { email: true } } } } },
  });
  if (!order || order.status !== "PENDING") return { ok: false, configured: true, error: "This order can't be paid for." };

  // Paystack rejects a missing or malformed email with a 400.
  const payerEmail = EMAIL_PATTERN.test(email.trim()) ? email.trim() : order.reader?.user?.email ?? "";
  if (!EMAIL_PATTERN.test(payerEmail)) return { ok: false, configured: true, error: "Enter a valid email address to receive your receipt." };

  try {
    const { authorizationUrl } = await initializePaystackTransaction(
      payerEmail,
      Math.round(Number(order.totalAmount) * 100),
      orderId,
      `${base}/checkout/return?gateway=paystack&orderId=${orderId}`,
      method === "mpesa" ? { channels: ["mobile_money"] } : undefined
    );
    return { ok: true, configured: true, redirectUrl: authorizationUrl };
  } catch (e) {
    return { ok: false, configured: true, error: e instanceof Error ? e.message : "Paystack error." };
  }
}

/** Whether PayPal can be offered at checkout. Reports only yes/no - the
 * credentials themselves never leave the server. */
export async function isPaypalAvailable(): Promise<boolean> {
  const { clientId, clientSecret } = await getPaypalCredentials();
  return !!clientId && !!clientSecret;
}

/**
 * Starts a PayPal payment for an already-created pending order and returns
 * the PayPal page to send the buyer to. The amount charged is read from our
 * own order record, never taken from the browser.
 */
export async function initiatePayPalCheckout(orderId: string): Promise<{ ok: boolean; redirectUrl?: string; error?: string }> {
  if (!(await isPaypalAvailable())) return { ok: false, error: "PayPal isn't available right now." };
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { status: true, totalAmount: true } });
  if (!order || order.status !== "PENDING") return { ok: false, error: "This order can't be paid for." };
  const base = getPublicSiteUrl();
  try {
    const { approvalUrl } = await createPaypalOrder(
      orderId,
      Number(order.totalAmount),
      `${base}/checkout/return?gateway=paypal&orderId=${orderId}`,
      `${base}/checkout?payment_failed=1`,
    );
    return { ok: true, redirectUrl: approvalUrl };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "PayPal error." };
  }
}
