"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authEither as auth } from "@/lib/auth-either";
import { computeWalletForUserId } from "@/lib/compute-wallet-for-user";
import { MIN_PAYOUT_AMOUNT } from "@/lib/payout-threshold";
import { reportSystemError } from "@/lib/site-health/alert";
import { createPayoutOnce } from "@/lib/payout-guard";

async function requireAdminRole() {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== "ADMIN") {
    throw new Error("Only Admins can queue payouts.");
  }
  return role;
}

/**
 * Admin-triggered replacement for the old automatic monthly cron (see
 * the deleted app/api/cron/monthly-payouts/route.ts) — ports the same
 * eligibility computation (every author/affiliate's real Available
 * balance, per lib/wallet.ts's calendar-month release rule, against
 * MIN_PAYOUT_AMOUNT) but as a button an Admin clicks from
 * app/admin/payouts/page.tsx, rather than something that runs and pays
 * money on its own. Idempotent: skips anyone who already has a
 * PayoutRequest for that earnings type queued this calendar month, so
 * clicking the button twice in the same month (or after some payouts
 * were already queued) never creates duplicate rows.
 */
export async function queueDuePayouts(): Promise<{ ok: boolean; queued?: number; error?: string }> {
  try {
    await requireAdminRole();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Not authorized." };
  }

  try {
    let queued = 0;

    // One loop body for both wallets, so the "never a second request for
    // the same user + same earnings type + same month" guard is applied
    // identically to each (see createPayoutOnce in lib/payout-guard.ts,
    // which re-checks inside the same serializable transaction as the
    // insert — a double click or two tabs can no longer both create one).
    async function queueFor(userId: string, view: "author" | "affiliate", earningsType: "AUTHOR" | "AFFILIATE") {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const alreadyQueued = await prisma.payoutRequest.findFirst({
        where: { userId, earningsType, requestedAt: { gte: monthStart, lt: nextMonthStart } },
      });
      if (alreadyQueued) return;

      const wallet = await computeWalletForUserId(userId, view);
      if (wallet.available < MIN_PAYOUT_AMOUNT) return;
      const recipient = await prisma.wiseRecipient.findFirst({ where: { userId }, orderBy: { isDefault: "desc" } });
      if (!recipient) return;
      const outcome = await createPayoutOnce({ userId, recipientId: recipient.id, amount: wallet.available, earningsType, now });
      if (outcome.created) queued++;
    }

    const authors = await prisma.user.findMany({
      where: { role: "AUTHOR", authorProfile: { isNot: null } },
      select: { id: true },
    });
    for (const u of authors) await queueFor(u.id, "author", "AUTHOR");

    const affiliateProfiles = await prisma.affiliateProfile.findMany({ select: { userId: true } });
    for (const a of affiliateProfiles) await queueFor(a.userId, "affiliate", "AFFILIATE");

    revalidatePath("/admin/payouts");
    return { ok: true, queued };
  } catch (e) {
    // This is the real payout-queueing logic failing (not the
    // requireAdminRole() check above, which already returned on its
    // own) — exactly the kind of payout-pipeline breakdown Site
    // Health's alerting exists to catch immediately.
    await reportSystemError("PAYOUT", e, { action: "queueDuePayouts" });
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't queue this month's payouts — please try again." };
  }
}
