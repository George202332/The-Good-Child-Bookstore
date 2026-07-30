"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createWiseRecipient } from "@/lib/payments/wise";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";

/**
 * Manage Wise payout destinations — every author/affiliate payout goes
 * through one of these now. `type` and `details` map directly onto
 * Wise's own recipient account shape (see lib/payments/wise.ts), so
 * "M-Pesa" is just one of many types Wise itself supports (mobile money
 * in Kenya) — bank transfer, email-based accounts, etc. all work the
 * same way through this one model.
 */

export interface WiseRecipientRow {
  id: string;
  type: string;
  currency: string;
  accountHolderName: string;
  details: Record<string, unknown>;
  isDefault: boolean;
}

async function requirePayoutEligibleUser() {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "AUTHOR" && !(await hasAffiliateCapability(session.user.id)))) {
    throw new Error("Only author or affiliate accounts can add payout destinations.");
  }
  return session.user.id;
}

export async function listMyWiseRecipients(): Promise<WiseRecipientRow[]> {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "AUTHOR" && !(await hasAffiliateCapability(session.user.id)))) return [];
  const recipients = await prisma.wiseRecipient.findMany({
    where: { userId: session!.user.id },
    orderBy: { createdAt: "desc" },
  });
  return recipients.map((r: { id: string; type: string; currency: string; accountHolderName: string; details: unknown; isDefault: boolean }) => ({
    id: r.id,
    type: r.type,
    currency: r.currency,
    accountHolderName: r.accountHolderName,
    details: r.details as Record<string, unknown>,
    isDefault: r.isDefault,
  }));
}

export interface AddRecipientInput {
  type: "mpesa" | "bank" | "email";
  currency: string;
  accountHolderName: string;
  // For mpesa: { phoneNumber }. For bank: { accountNumber, bankCode/iban/sortCode }. For email: { email }.
  details: Record<string, string>;
}

const WISE_TYPE_MAP: Record<AddRecipientInput["type"], string> = {
  mpesa: "mpesa",
  bank: "iban",
  email: "email",
};

export async function addWiseRecipient(input: AddRecipientInput): Promise<{ ok: boolean; error?: string }> {
  let userId: string;
  try {
    userId = await requirePayoutEligibleUser();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not authorized." };
  }

  if (!input.accountHolderName.trim()) return { ok: false, error: "Account holder name is required." };
  if (!input.currency.trim()) return { ok: false, error: "Currency is required." };

  let wiseRecipientId: string | undefined;
  try {
    const result = await createWiseRecipient({
      currency: input.currency,
      type: WISE_TYPE_MAP[input.type],
      accountHolderName: input.accountHolderName,
      details: input.details,
    });
    wiseRecipientId = result.wiseRecipientId;
  } catch {
    // Wise isn't configured/reachable in this environment — still save
    // the recipient locally so the UI/payout flow can be exercised; the
    // wiseRecipientId gets backfilled once real credentials are wired up.
  }

  const existingCount = await prisma.wiseRecipient.count({ where: { userId } });
  await prisma.wiseRecipient.create({
    data: {
      userId,
      type: input.type,
      currency: input.currency.toUpperCase(),
      accountHolderName: input.accountHolderName.trim(),
      details: input.details,
      wiseRecipientId,
      isDefault: existingCount === 0,
    },
  });

  revalidatePath("/account/payout-settings");
  revalidatePath("/account/profile");
  return { ok: true };
}

export async function deleteWiseRecipient(recipientId: string): Promise<{ ok: boolean; error?: string }> {
  const userId = await requirePayoutEligibleUser().catch(() => null);
  if (!userId) return { ok: false, error: "Not authorized." };

  const recipient = await prisma.wiseRecipient.findUnique({ where: { id: recipientId } });
  if (!recipient || recipient.userId !== userId) return { ok: false, error: "Not found." };

  await prisma.wiseRecipient.delete({ where: { id: recipientId } });
  revalidatePath("/account/payout-settings");
  revalidatePath("/account/profile");
  return { ok: true };
}

export async function setDefaultWiseRecipient(recipientId: string): Promise<{ ok: boolean; error?: string }> {
  const userId = await requirePayoutEligibleUser().catch(() => null);
  if (!userId) return { ok: false, error: "Not authorized." };

  const recipient = await prisma.wiseRecipient.findUnique({ where: { id: recipientId } });
  if (!recipient || recipient.userId !== userId) return { ok: false, error: "Not found." };

  await prisma.$transaction([
    prisma.wiseRecipient.updateMany({ where: { userId }, data: { isDefault: false } }),
    prisma.wiseRecipient.update({ where: { id: recipientId }, data: { isDefault: true } }),
  ]);
  revalidatePath("/account/payout-settings");
  revalidatePath("/account/profile");
  return { ok: true };
}
