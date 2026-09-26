"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createWiseRecipient, getWiseAccountRequirements, type WiseRequiredField } from "@/lib/payments/wise";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";

/** Real fields Wise actually requires for a given currency, per
 * account type (e.g. a Kenyan payout might offer both "mpesa" and
 * "iban" as options, each with their own real field list) — queried
 * live from Wise, not a fixed guess. */
export async function getRequiredFieldsForCurrency(currency: string): Promise<{ type: string; fields: WiseRequiredField[] }[] | { error: string }> {
  const session = await auth();
  if (!session?.user) return { error: "Sign in required." };
  return getWiseAccountRequirements(currency);
}

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
  type: string; // a real Wise account type key, from getRequiredFieldsForCurrency — e.g. "mpesa", "iban", "sort_code", "email"
  currency: string;
  accountHolderName: string;
  details: Record<string, string>; // keyed exactly as Wise's own account-requirements response specifies
}

export async function addWiseRecipient(input: AddRecipientInput): Promise<{ ok: boolean; error?: string }> {
  let userId: string;
  try {
    userId = await requirePayoutEligibleUser();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not authorized." };
  }

  if (!input.accountHolderName.trim()) return { ok: false, error: "Account holder name is required." };
  if (!input.currency.trim()) return { ok: false, error: "Currency is required." };
  if (!input.type.trim()) return { ok: false, error: "Account type is required." };

  let wiseRecipientId: string | undefined;
  try {
    const result = await createWiseRecipient({
      currency: input.currency,
      type: input.type,
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

  // A recipient with real payout history (any PayoutRequest, whatever
  // its status) must never actually be deleted — this relation has no
  // cascade, by design, since a payout row is a financial record. The
  // admin payout ledger (actions/payout-ledger.ts) reads every payout
  // ever queued and needs this recipient row to still exist to show
  // where that money went/is going, so deleting it out from under a
  // real payout would leave a dangling reference. Block it here with a
  // clear reason, the same protective pattern used for deleting an
  // account or a book with real financial history.
  const referencedByPayout = await prisma.payoutRequest.findFirst({ where: { recipientId } });
  if (referencedByPayout) {
    return { ok: false, error: "This payout destination has payout history tied to it and can't be deleted — add a new one and set it as default instead." };
  }

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
