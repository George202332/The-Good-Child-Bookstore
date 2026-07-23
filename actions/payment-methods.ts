"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * Saved payment methods — deliberately built only on top of Paystack's
 * own reusable "authorization" token (returned after a successful
 * charge), never raw card numbers. The actual card details never touch
 * our servers at all, on the first charge or any reuse — see
 * lib/payments/paystack.ts chargeAuthorization().
 */

export interface SavedPaymentMethodRow {
  id: string;
  cardType: string | null;
  last4: string | null;
  bank: string | null;
  isDefault: boolean;
}

/** Called from the checkout return page / webhook after a successful
 * Paystack charge whose card supports reuse — saves the token if it's
 * not already on file for this reader. */
export async function saveCardIfReusable(
  orderId: string,
  authorization: { code: string; cardType: string; last4: string; bank: string } | null
): Promise<void> {
  if (!authorization) return;
  try {
    const order = await prisma.order.findUnique({ where: { id: orderId }, select: { readerId: true } });
    if (!order) return;

    const existing = await prisma.savedPaymentMethod.findFirst({
      where: { readerId: order.readerId, authorizationCode: authorization.code },
    });
    if (existing) return;

    const existingCount = await prisma.savedPaymentMethod.count({ where: { readerId: order.readerId } });
    await prisma.savedPaymentMethod.create({
      data: {
        readerId: order.readerId,
        gateway: "PAYSTACK",
        authorizationCode: authorization.code,
        cardType: authorization.cardType,
        last4: authorization.last4,
        bank: authorization.bank,
        isDefault: existingCount === 0,
      },
    });
  } catch {
    // Non-critical — a failed save here shouldn't affect order confirmation.
  }
}

export async function listMyPaymentMethods(): Promise<SavedPaymentMethodRow[]> {
  const session = await auth();
  if (session?.user?.role !== "READER") return [];
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { readerProfile: true } });
  if (!user?.readerProfile) return [];

  const methods = await prisma.savedPaymentMethod.findMany({
    where: { readerId: user.readerProfile.id },
    orderBy: { createdAt: "desc" },
  });
  return methods.map((m: { id: string; cardType: string | null; last4: string | null; bank: string | null; isDefault: boolean }) => ({
    id: m.id,
    cardType: m.cardType,
    last4: m.last4,
    bank: m.bank,
    isDefault: m.isDefault,
  }));
}

export async function deleteSavedPaymentMethod(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "READER") return { ok: false, error: "Not authorized." };
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { readerProfile: true } });
  const method = await prisma.savedPaymentMethod.findUnique({ where: { id } });
  if (!method || !user?.readerProfile || method.readerId !== user.readerProfile.id) {
    return { ok: false, error: "Not found." };
  }
  await prisma.savedPaymentMethod.delete({ where: { id } });
  revalidatePath("/account/payment-methods");
  return { ok: true };
}

export async function setDefaultPaymentMethod(id: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "READER") return { ok: false, error: "Not authorized." };
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { readerProfile: true } });
  const method = await prisma.savedPaymentMethod.findUnique({ where: { id } });
  if (!method || !user?.readerProfile || method.readerId !== user.readerProfile.id) {
    return { ok: false, error: "Not found." };
  }
  await prisma.$transaction([
    prisma.savedPaymentMethod.updateMany({ where: { readerId: user.readerProfile.id }, data: { isDefault: false } }),
    prisma.savedPaymentMethod.update({ where: { id }, data: { isDefault: true } }),
  ]);
  revalidatePath("/account/payment-methods");
  return { ok: true };
}

/** Charges a saved card directly at checkout — no hosted redirect. */
export async function payWithSavedCard(
  savedMethodId: string,
  orderId: string,
  amountUsd: number,
  email: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (session?.user?.role !== "READER") return { ok: false, error: "Not authorized." };

  const method = await prisma.savedPaymentMethod.findUnique({ where: { id: savedMethodId } });
  if (!method) return { ok: false, error: "Payment method not found." };

  const { chargeAuthorization } = await import("@/lib/payments/paystack");
  const { finalizeOrderPayment } = await import("@/lib/payments/finalize");
  const result = await chargeAuthorization(method.authorizationCode, email, Math.round(amountUsd * 100), orderId);
  if (!result.success) return { ok: false, error: "Charge failed. Please try a different payment method." };

  await finalizeOrderPayment(orderId, "PAYSTACK", { source: "saved_card", reference: result.reference });
  return { ok: true };
}
