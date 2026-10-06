"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";
import { isPayoutMethodLocked, payoutLockMessage } from "@/lib/payout-lock";
import { getSiteSettings } from "@/actions/site-settings";
import { isPayoutMethodTypeAvailable, PAYOUT_METHOD_UNAVAILABLE_MESSAGE } from "@/lib/payout-method-availability";
import { isPayoutRestrictedCountry, payoutRestrictionMessage } from "@/lib/payout-country-restriction";

/**
 * Manage payout destinations — PayPal, bank transfer, or M-Pesa. Every
 * author/affiliate payout is executed manually by an admin outside this
 * system (see actions/admin.ts approvePayoutRequest and
 * actions/payouts.ts queueDuePayouts); these rows just record where
 * that money should go. Renamed from actions/wise-recipients.ts per
 * explicit instruction — the underlying Prisma model is still called
 * `WiseRecipient` for historical reasons (renaming it would force
 * `prisma db push` to drop and recreate the table, losing production
 * data), but nothing here talks to Wise or any other payment gateway
 * any more.
 */

export interface PayoutMethodRow {
  id: string;
  type: string;
  currency: string;
  accountHolderName: string;
  details: Record<string, unknown>;
  isDefault: boolean;
}

async function requirePayoutEligibleUser(): Promise<{ userId: string; country: string | null }> {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "AUTHOR" && !(await hasAffiliateCapability(session.user.id)))) {
    throw new Error("Only author or affiliate accounts can add payout destinations.");
  }
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { country: true } });
  return { userId: session.user.id, country: user?.country ?? null };
}

/** Server-side check that a method type is currently selectable (admin
 * toggles in Site Settings; bank transfer is always allowed). */
async function isMethodTypeAvailableNow(type: string): Promise<boolean> {
  const settings = await getSiteSettings();
  return isPayoutMethodTypeAvailable(type, settings);
}

export async function listMyPayoutMethods(): Promise<PayoutMethodRow[]> {
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

export interface AddPayoutMethodInput {
  type: string; // "email" (PayPal), "bank", or "mpesa"
  currency: string;
  accountHolderName: string;
  details: Record<string, string>;
}

/**
 * Adds a new payout method. The country-restriction check only applies
 * when this would become the user's FIRST method (first-time setup is
 * always allowed regardless of country, per explicit instruction) is
 * NOT an exception that's carved out here — first-time setup is still
 * blocked for a restricted country, since "setup" in the brief means
 * configuring any payout destination at all; what's always allowed
 * regardless of date is the payout-method LOCK (see isPayoutMethodLocked),
 * a separate rule from the country restriction.
 */
export async function addPayoutMethod(input: AddPayoutMethodInput): Promise<{ ok: boolean; error?: string }> {
  let userId: string;
  let country: string | null;
  try {
    ({ userId, country } = await requirePayoutEligibleUser());
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not authorized." };
  }

  if (isPayoutRestrictedCountry(country)) {
    return { ok: false, error: payoutRestrictionMessage() };
  }

  if (!input.accountHolderName.trim()) return { ok: false, error: "Account holder name is required." };
  if (!input.currency.trim()) return { ok: false, error: "Currency is required." };
  if (!input.type.trim()) return { ok: false, error: "Account type is required." };
  if (!(await isMethodTypeAvailableNow(input.type))) return { ok: false, error: PAYOUT_METHOD_UNAVAILABLE_MESSAGE };

  const existingCount = await prisma.wiseRecipient.count({ where: { userId } });
  await prisma.wiseRecipient.create({
    data: {
      userId,
      type: input.type,
      currency: input.currency.toUpperCase(),
      accountHolderName: input.accountHolderName.trim(),
      details: input.details,
      isDefault: existingCount === 0,
    },
  });

  revalidatePath("/account/payout-settings");
  revalidatePath("/account/profile");
  return { ok: true };
}

export async function deletePayoutMethod(recipientId: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  const userId = session?.user?.id;
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
    return { ok: false, error: "This payout destination has payout history tied to it and can't be deleted — add a new one and set it as active instead." };
  }

  await prisma.wiseRecipient.delete({ where: { id: recipientId } });
  revalidatePath("/account/payout-settings");
  revalidatePath("/account/profile");
  return { ok: true };
}

/**
 * Switches which method is active for payouts — blocked after the 10th
 * of the month (see lib/payout-lock.ts), UNLESS the user doesn't have an
 * active method yet at all (first-time setup is always allowed).
 */
export async function setActivePayoutMethod(recipientId: string): Promise<{ ok: boolean; error?: string }> {
  let userId: string;
  let country: string | null;
  try {
    ({ userId, country } = await requirePayoutEligibleUser());
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not authorized." };
  }

  const recipient = await prisma.wiseRecipient.findUnique({ where: { id: recipientId } });
  if (!recipient || recipient.userId !== userId) return { ok: false, error: "Not found." };

  // Saved PayPal / M-Pesa records are kept, but can't be switched to
  // while that method is turned off.
  if (!(await isMethodTypeAvailableNow(recipient.type))) return { ok: false, error: PAYOUT_METHOD_UNAVAILABLE_MESSAGE };

  const hasActiveAlready = await prisma.wiseRecipient.findFirst({ where: { userId, isDefault: true } });
  if (hasActiveAlready && hasActiveAlready.id !== recipientId && isPayoutMethodLocked()) {
    return { ok: false, error: payoutLockMessage() };
  }

  // A restricted-country user can keep using an already-active method
  // as-is (never blocked), but can't switch TO a different one — that's
  // "new payout-method setup/activation", exactly what's restricted.
  if (!hasActiveAlready?.id || hasActiveAlready.id !== recipientId) {
    if (isPayoutRestrictedCountry(country)) {
      return { ok: false, error: payoutRestrictionMessage() };
    }
  }

  await prisma.$transaction([
    prisma.wiseRecipient.updateMany({ where: { userId }, data: { isDefault: false } }),
    prisma.wiseRecipient.update({ where: { id: recipientId }, data: { isDefault: true } }),
  ]);
  revalidatePath("/account/payout-settings");
  revalidatePath("/account/profile");
  return { ok: true };
}

export interface UpdatePayoutMethodInput {
  accountHolderName: string;
  currency: string;
  details: Record<string, string>;
}

/**
 * A real, in-place UPDATE — replaces the old delete-then-recreate
 * pattern, which had a latent bug: if the delete failed (e.g. the
 * recipient had payout history and deletePayoutMethod correctly
 * refused), the old code pressed ahead and created a brand-new row
 * anyway, leaving both the orphaned original AND a duplicate behind.
 * Editing the currently-active method's details is blocked after the
 * 10th of the month (same lock as switching which method is active);
 * editing a non-active method is always allowed.
 */
export async function updatePayoutMethod(recipientId: string, input: UpdatePayoutMethodInput): Promise<{ ok: boolean; error?: string }> {
  let userId: string;
  try {
    ({ userId } = await requirePayoutEligibleUser());
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not authorized." };
  }

  if (!input.accountHolderName.trim()) return { ok: false, error: "Account holder name is required." };
  if (!input.currency.trim()) return { ok: false, error: "Currency is required." };

  const recipient = await prisma.wiseRecipient.findUnique({ where: { id: recipientId } });
  if (!recipient || recipient.userId !== userId) return { ok: false, error: "Not found." };

  if (!(await isMethodTypeAvailableNow(recipient.type))) return { ok: false, error: PAYOUT_METHOD_UNAVAILABLE_MESSAGE };

  if (recipient.isDefault && isPayoutMethodLocked()) {
    return { ok: false, error: payoutLockMessage() };
  }

  await prisma.wiseRecipient.update({
    where: { id: recipientId },
    data: {
      accountHolderName: input.accountHolderName.trim(),
      currency: input.currency.toUpperCase(),
      details: input.details,
    },
  });

  revalidatePath("/account/payout-settings");
  revalidatePath("/account/profile");
  return { ok: true };
}
