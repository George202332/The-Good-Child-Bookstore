"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { authEither as auth } from "@/lib/auth-either";
import { computeWalletForUserId } from "@/lib/compute-wallet-for-user";
import { MIN_PAYOUT_AMOUNT } from "@/lib/payout-threshold";

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
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let queued = 0;

    const authors = await prisma.user.findMany({
      where: { role: "AUTHOR", authorProfile: { isNot: null } },
      select: { id: true },
    });
    for (const u of authors) {
      const alreadyQueued = await prisma.payoutRequest.findFirst({
        where: { userId: u.id, earningsType: "AUTHOR", requestedAt: { gte: monthStart } },
      });
      if (alreadyQueued) continue;

      const wallet = await computeWalletForUserId(u.id, "author");
      if (wallet.available < MIN_PAYOUT_AMOUNT) continue;
      const recipient = await prisma.wiseRecipient.findFirst({ where: { userId: u.id }, orderBy: { isDefault: "desc" } });
      if (!recipient) continue;
      await prisma.payoutRequest.create({
        data: { userId: u.id, recipientId: recipient.id, amount: wallet.available, currency: "USD", earningsType: "AUTHOR" },
      });
      queued++;
    }

    const affiliateProfiles = await prisma.affiliateProfile.findMany({ select: { userId: true } });
    for (const a of affiliateProfiles) {
      const alreadyQueued = await prisma.payoutRequest.findFirst({
        where: { userId: a.userId, earningsType: "AFFILIATE", requestedAt: { gte: monthStart } },
      });
      if (alreadyQueued) continue;

      const wallet = await computeWalletForUserId(a.userId, "affiliate");
      if (wallet.available < MIN_PAYOUT_AMOUNT) continue;
      const recipient = await prisma.wiseRecipient.findFirst({ where: { userId: a.userId }, orderBy: { isDefault: "desc" } });
      if (!recipient) continue;
      await prisma.payoutRequest.create({
        data: { userId: a.userId, recipientId: recipient.id, amount: wallet.available, currency: "USD", earningsType: "AFFILIATE" },
      });
      queued++;
    }

    revalidatePath("/admin/payouts");
    return { ok: true, queued };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't queue this month's payouts — please try again." };
  }
}
