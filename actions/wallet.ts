"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { computeWallet, type Wallet } from "@/lib/wallet";

/**
 * Real wallet balance (On Hold / Available) for the signed-in author or
 * affiliate — see lib/wallet.ts for the 10-day hold rule. Replaces the
 * single "available balance" number the earlier payouts.ts had; this is
 * role-aware (authors earn authorShare on their own books, affiliates
 * earn affiliateShare on their own AffiliateLinks) but shares the same
 * hold/payout math either way.
 */

export interface WalletResult extends Wallet {
  saleCount: number;
}

const EMPTY_WALLET: WalletResult = { totalEarned: 0, onHold: 0, available: 0, saleCount: 0 };

export async function getMyWallet(): Promise<WalletResult> {
  const session = await auth();
  const role = session?.user?.role;
  if (role !== "AUTHOR" && role !== "AFFILIATE") return EMPTY_WALLET;

  try {
    let lines: { createdAt: Date; amount: number }[] = [];

    if (role === "AUTHOR") {
      const user = await prisma.user.findUnique({
        where: { id: session!.user.id },
        include: { authorProfile: { include: { books: { include: { saleLines: true } } } } },
      });
      const books = user?.authorProfile?.books ?? [];
      lines = books.flatMap((b: { saleLines: { createdAt: Date; authorShare: unknown }[] }) =>
        b.saleLines.map((l) => ({ createdAt: l.createdAt, amount: Number(l.authorShare) }))
      );
    } else {
      const user = await prisma.user.findUnique({
        where: { id: session!.user.id },
        include: { affiliateProfile: { include: { affiliateLinks: { include: { saleLines: true } } } } },
      });
      const links = user?.affiliateProfile?.affiliateLinks ?? [];
      lines = links.flatMap((l: { saleLines: { createdAt: Date; affiliateShare: unknown }[] }) =>
        l.saleLines.map((s) => ({ createdAt: s.createdAt, amount: Number(s.affiliateShare) }))
      );
    }

    const payouts = await prisma.payoutRequest.findMany({ where: { userId: session!.user.id } });
    const paidOut = payouts
      .filter((p: { status: string }) => p.status === "PAID")
      .reduce((sum: number, p: { amount: unknown }) => sum + Number(p.amount), 0);
    const pending = payouts
      .filter((p: { status: string }) => p.status === "REQUESTED" || p.status === "APPROVED")
      .reduce((sum: number, p: { amount: unknown }) => sum + Number(p.amount), 0);

    const wallet = computeWallet(lines, paidOut, pending);
    return { ...wallet, saleCount: lines.length };
  } catch {
    return EMPTY_WALLET;
  }
}
