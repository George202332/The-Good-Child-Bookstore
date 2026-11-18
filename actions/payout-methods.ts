"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { hasAffiliateCapability } from "@/lib/affiliate-capability";
import { isPayoutDetailsLocked, payoutLockMessage, resolvePayoutSchedule, type PayoutSchedule } from "@/lib/payout-schedule";
import { getSiteSettings } from "@/actions/site-settings";
import { isPayoutMethodTypeAvailable, PAYOUT_METHOD_UNAVAILABLE_MESSAGE } from "@/lib/payout-method-availability";
import { getCountrySupport } from "@/lib/verto-support";
import { validateBankDetails } from "@/lib/payout-bank-fields";
import { isPayoutRestrictedCountry, payoutRestrictionMessage } from "@/lib/payout-country-restriction";
import { logSelfServiceEvent } from "@/lib/audit-log";
import { payoutMethodLabel } from "@/lib/payout-method-label";
import { PAYOUT_METHOD_FIELDS, buildChangeMetadata, diffFields, payoutSnapshot } from "@/lib/activity-diff";

/**
 * Manage payout destinations — Bank Transfer only (paid through Verto). Every
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
  return isPayoutMethodTypeAvailable(type);
}

/** The payout calendar from the admin setting (lock day and release day). */
async function currentSchedule(): Promise<PayoutSchedule> {
  return resolvePayoutSchedule(await getSiteSettings());
}

/** The lock window: from the lock day until the payout is released, and nothing else. Null when changes are allowed. */
async function lockedMessageNow(): Promise<string | null> {
  const schedule = await currentSchedule();
  return isPayoutDetailsLocked(schedule) ? payoutLockMessage(schedule) : null;
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
  type: string; // only "bank" (Bank Transfer, paid through Verto) is accepted
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
 * regardless of date is the payout-method LOCK (see lib/payout-schedule.ts),
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

  const lockedNow = await lockedMessageNow();
  if (lockedNow) return { ok: false, error: lockedNow };
  const bankCountry = input.details.country ?? "";
  const support = await getCountrySupport(bankCountry);
  if (support.state !== "supported") return { ok: false, error: support.message };
  const missing = validateBankDetails(bankCountry, input.details);
  if (missing) return { ok: false, error: missing };

  const existingCount = await prisma.wiseRecipient.count({ where: { userId } });
  const created = await prisma.wiseRecipient.create({
    data: {
      userId,
      type: input.type,
      currency: input.currency.toUpperCase(),
      accountHolderName: input.accountHolderName.trim(),
      details: input.details,
      isDefault: existingCount === 0,
    },
  });

  const addedLabel = payoutMethodLabel(created.type);
  const addedChanges = diffFields({}, payoutSnapshot(created), PAYOUT_METHOD_FIELDS);
  await logSelfServiceEvent(userId, "PAYOUT_METHOD_ADDED", {
    ...(buildChangeMetadata(`Added payout method: ${addedLabel} (${created.currency})`, addedChanges) ?? { summary: `Added payout method: ${addedLabel} (${created.currency})` }),
    recipientId: created.id,
    methodType: created.type,
    methodLabel: addedLabel,
    isDefault: created.isDefault,
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
  const removedLabel = payoutMethodLabel(recipient.type);
  await logSelfServiceEvent(userId, "PAYOUT_METHOD_REMOVED", {
    summary: `Removed payout method: ${removedLabel} (${recipient.currency})`,
    recipientId,
    methodType: recipient.type,
    methodLabel: removedLabel,
    wasDefault: recipient.isDefault,
  });
  revalidatePath("/account/payout-settings");
  revalidatePath("/account/profile");
  return { ok: true };
}

/**
 * Switches which method is active for payouts — blocked only inside the
 * lock window (lock day until the release day, see lib/payout-schedule.ts).
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
  const lockedNow = await lockedMessageNow();
  if (lockedNow) return { ok: false, error: lockedNow };

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
  // Re-activating the method that is already active changes nothing — no entry.
  if (!hasActiveAlready || hasActiveAlready.id !== recipientId) {
    const toLabel = payoutMethodLabel(recipient.type);
    const fromLabel = hasActiveAlready ? payoutMethodLabel(hasActiveAlready.type) : null;
    await logSelfServiceEvent(userId, "PAYOUT_METHOD_ACTIVATED", {
      summary: fromLabel ? `Switched active payout method: ${fromLabel} -> ${toLabel}` : `Set active payout method: ${toLabel}`,
      recipientId,
      methodType: recipient.type,
      methodLabel: toLabel,
      previousMethodType: hasActiveAlready?.type ?? null,
    });
  }
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
 * Editing details is blocked only inside the lock window (lock day until
 * the release day, see lib/payout-schedule.ts).
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

  const lockedNow = await lockedMessageNow();
  if (lockedNow) return { ok: false, error: lockedNow };
  const updCountry = input.details.country ?? "";
  const support = await getCountrySupport(updCountry);
  if (support.state !== "supported") return { ok: false, error: support.message };
  const missing = validateBankDetails(updCountry, input.details);
  if (missing) return { ok: false, error: missing };

  const updated = await prisma.wiseRecipient.update({
    where: { id: recipientId },
    data: {
      accountHolderName: input.accountHolderName.trim(),
      currency: input.currency.toUpperCase(),
      details: input.details,
    },
  });

  // Field-level diff (account numbers / SWIFT / phone are masked inside
  // diffFields); nothing is written when nothing actually changed.
  const updatedLabel = payoutMethodLabel(updated.type);
  await logSelfServiceEvent(
    userId,
    "PAYOUT_METHOD_UPDATED",
    buildChangeMetadata(
      `Updated payout details (${updatedLabel})`,
      diffFields(payoutSnapshot(recipient), payoutSnapshot(updated), PAYOUT_METHOD_FIELDS),
      { recipientId, methodType: updated.type, methodLabel: updatedLabel, isDefault: updated.isDefault }
    )
  );

  revalidatePath("/account/payout-settings");
  revalidatePath("/account/profile");
  return { ok: true };
}

export interface BankCountryCheck {
  state: "supported" | "unsupported" | "unreachable";
  message?: string;
  fields: { key: string; label: string; placeholder?: string; required: boolean }[];
}

/** Which fields Bank Transfer needs for a country, or why it cannot be used (Verto decides once it can answer). */
export async function checkBankCountry(iso2: string): Promise<BankCountryCheck> {
  const session = await auth();
  if (!session?.user) return { state: "unsupported", message: "You need to be signed in.", fields: [] };
  const support = await getCountrySupport(iso2);
  if (support.state !== "supported") return { state: support.state, message: support.message, fields: [] };
  const { bankFieldsForCountry } = await import("@/lib/payout-bank-fields");
  return { state: "supported", fields: bankFieldsForCountry(iso2) };
}
