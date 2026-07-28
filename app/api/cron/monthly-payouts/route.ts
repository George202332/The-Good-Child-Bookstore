import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeWalletForUserId } from "@/lib/compute-wallet-for-user";

/**
 * Runs automatically on the 15th of every month (see vercel.json's cron
 * schedule) — replaces the old "click a button to request a payout"
 * flow entirely. For every author and every affiliate (including a
 * Reader/Author who's enabled affiliate access), computes their real
 * Available balance (money earned last month or earlier, per
 * lib/wallet.ts's calendar-month release rule) and automatically
 * creates a PayoutRequest for it against their default Wise recipient,
 * if they have one and an available balance greater than zero. Admin
 * still reviews and actually sends the money via Wise (see
 * actions/admin.ts approvePayoutRequest) — this job only handles
 * "figuring out who's owed what and queuing it up", not moving money
 * itself.
 *
 * Protected by CRON_SECRET so this can't be triggered by just anyone
 * hitting the URL — Vercel Cron sends this automatically when the env
 * var is set; without it configured, the route refuses all requests.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const results: { userId: string; role: string; amount: number }[] = [];

  try {
    const authors = await prisma.user.findMany({
      where: { role: "AUTHOR", authorProfile: { isNot: null } },
      select: { id: true },
    });
    for (const u of authors) {
      const wallet = await computeWalletForUserId(u.id, "author");
      if (wallet.available <= 0) continue;
      const recipient = await prisma.wiseRecipient.findFirst({ where: { userId: u.id }, orderBy: { isDefault: "desc" } });
      if (!recipient) continue;
      await prisma.payoutRequest.create({
        data: { userId: u.id, recipientId: recipient.id, amount: wallet.available, currency: "USD" },
      });
      results.push({ userId: u.id, role: "AUTHOR", amount: wallet.available });
    }

    const affiliateProfiles = await prisma.affiliateProfile.findMany({ select: { userId: true } });
    for (const a of affiliateProfiles) {
      const wallet = await computeWalletForUserId(a.userId, "affiliate");
      if (wallet.available <= 0) continue;
      const recipient = await prisma.wiseRecipient.findFirst({ where: { userId: a.userId }, orderBy: { isDefault: "desc" } });
      if (!recipient) continue;
      await prisma.payoutRequest.create({
        data: { userId: a.userId, recipientId: recipient.id, amount: wallet.available, currency: "USD" },
      });
      results.push({ userId: a.userId, role: "AFFILIATE", amount: wallet.available });
    }

    return NextResponse.json({ ok: true, payoutsCreated: results.length, results });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
